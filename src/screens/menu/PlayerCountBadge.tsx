/**
 * Live footballer tally shown above the version line in the Menu. The count is
 * read straight from the in-memory dataset via usePlayerCount, so it climbs on
 * its own the moment an OTA content pack adds players. A small green dot sends
 * out a radar "ping" ring that radiates and fades, then rests a beat before the
 * next one (ding… ding… ding…), reading as "live". Core `Animated` only (the
 * project ships no Reanimated — see docs/design.md §4).
 *
 * Under Reduce Motion the ring is dropped entirely and only the dot remains:
 * an endless radiating ring is exactly what the setting is asking us not to do,
 * and the ring is decorative, so nothing is lost but the flourish.
 */
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Text, useReduceMotion} from '../../core/ui';
import {usePlayerCount} from '../../data/football';
import {spacing, useThemedStyles, type Palette} from '../../theme';

const DOT = 7;
// The ping's own character, not part of the shared timing language: one ring
// travel, then a rest beat. Deliberately not a `motion` token — this is the
// only consumer.
const PING_MS = 1100;
const PING_REST_MS = 1300;

export function PlayerCountBadge() {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const count = usePlayerCount();
  const reduceMotion = useReduceMotion();
  const ping = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ping, {
          toValue: 1,
          duration: PING_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        // Rest between pings — the "…" in ding… ding… ding…
        Animated.delay(PING_REST_MS),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ping, reduceMotion]);

  // Ring grows out from the dot and fades to nothing; invisible while it rests.
  const ringScale = ping.interpolate({inputRange: [0, 1], outputRange: [1, 2.8]});
  const ringOpacity = ping.interpolate({inputRange: [0, 1], outputRange: [0.55, 0]});

  return (
    <View style={styles.row}>
      <View style={styles.ping}>
        {reduceMotion ? null : (
          <Animated.View
            style={[
              styles.ring,
              {opacity: ringOpacity, transform: [{scale: ringScale}]},
            ]}
          />
        )}
        <View style={styles.dot} />
      </View>
      <Text variant="caption" color="muted">
        {t('menu.playerCount', {n: count.toLocaleString()})}
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    ping: {
      width: DOT,
      height: DOT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ring: {
      position: 'absolute',
      width: DOT,
      height: DOT,
      borderRadius: DOT / 2,
      backgroundColor: c.success,
    },
    dot: {
      width: DOT,
      height: DOT,
      borderRadius: DOT / 2,
      backgroundColor: c.success,
    },
  });
