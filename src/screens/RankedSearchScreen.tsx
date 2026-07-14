import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {Lightbulb} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Button, Screen, Text, toast} from '../core/ui';
import type {RootStackParamList} from '../core/navigation';
import {
  cancelQueue,
  fetchQueueRoom,
  findMatch,
  subscribeQueue,
} from '../core/rooms/rankedService';
import {ensureSession} from '../core/supabase/client';
import {getCachedProfile} from '../core/social/socialService';
import {randomFootballName} from '../core/identity/funnyName';
import {radii, spacing, useColors, useThemedStyles, type Palette} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RankedSearch'>;

/** Fisher–Yates — a fresh hint order each time you enter matchmaking. */
function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Ranked matchmaking. Enqueues via `rh_find_match`; if paired immediately it
 * carries the roomId, otherwise it waits on the player's own queue row until the
 * server fills in a room. Leaving cancels the queue. A shuffle of ranked tips
 * rotates at the bottom while you wait.
 */
export function RankedSearchScreen({navigation}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const enteredRef = useRef(false);

  // Shuffle the tips once per visit, then rotate through them.
  const tips = useMemo(() => {
    const pool = t('rankedHattrick.tips', {returnObjects: true});
    return shuffle(Array.isArray(pool) ? (pool as string[]) : []);
  }, [t]);
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    if (tips.length === 0) {
      return;
    }
    const id = setInterval(() => setTipIndex(n => (n + 1) % tips.length), 3800);
    return () => clearInterval(id);
  }, [tips.length]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let alive = true;

    const enter = (roomId: string) => {
      if (enteredRef.current) {
        return;
      }
      enteredRef.current = true;
      navigation.replace('RankedHattrick', {roomId});
    };

    (async () => {
      const uid = await ensureSession().catch(() => null);
      if (!alive) {
        return;
      }
      if (!uid) {
        toast.error(t('common.errorNetwork'));
        navigation.goBack();
        return;
      }
      // Watch our queue row (fast path)…
      unsub = subscribeQueue(uid, enter);
      try {
        // Play under your real profile name (funny name only as a fallback).
        const profile = await getCachedProfile().catch(() => null);
        const name = profile?.displayName?.trim() || randomFootballName();
        const roomId = await findMatch(name);
        if (!alive) {
          return;
        }
        if (roomId) {
          enter(roomId);
          return;
        }
        // …and poll it too — the realtime echo isn't always delivered, so the
        // waiting player must never get stuck while the opponent has started.
        poll = setInterval(async () => {
          const paired = await fetchQueueRoom().catch(() => null);
          if (paired && alive) {
            enter(paired);
          }
        }, 2000);
      } catch {
        if (alive) {
          toast.error(t('common.errorNetwork'));
          navigation.goBack();
        }
      }
    })();

    return () => {
      alive = false;
      unsub?.();
      if (poll) {
        clearInterval(poll);
      }
      // Only cancel if we didn't get matched (leaving the search).
      if (!enteredRef.current) {
        cancelQueue().catch(() => {});
      }
    };
  }, [navigation, t]);

  return (
    <Screen canvas>
      <View style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="section" align="center" style={styles.title}>
            {t('rankedHattrick.finding')}
          </Text>
          <Text variant="secondary" color="secondary" align="center">
            {t('rankedHattrick.findingBody')}
          </Text>
          <Button
            label={t('rankedHattrick.cancel')}
            variant="outline"
            onPress={() => navigation.goBack()}
            style={styles.cancel}
          />
        </View>

        {tips.length > 0 ? (
          <View style={[styles.tipCard, {marginBottom: insets.bottom + spacing.lg}]}>
            <Lightbulb size={16} color={colors.primaryInk} strokeWidth={2} />
            <Text variant="secondary" color="secondary" style={styles.tipText}>
              {tips[tipIndex]}
            </Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {flex: 1, paddingHorizontal: spacing.xl},
    center: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md},
    title: {marginTop: spacing.sm},
    cancel: {marginTop: spacing.xl, alignSelf: 'stretch'},
    // The rotating hint, parked at the bottom.
    tipCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: c.surface,
      borderRadius: radii.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.divider,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: 64,
    },
    tipText: {flex: 1},
  });
