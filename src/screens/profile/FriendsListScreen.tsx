/**
 * The friends list — a plain Instagram-style page, opened from the Profile
 * tab's friends line. Just a list: avatar, name, an online dot, tapping a row
 * opens that friend's profile. Managing friends (add by code, search, requests,
 * swipe-remove) still lives on the Social tab; this page is only for browsing
 * the list and jumping into a profile.
 */
import React, {useCallback, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {ChevronRight} from 'lucide-react-native';
import {Avatar, GlassCard, Skeleton, Text, initialsFor} from '../../core/ui';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import type {RootStackParamList} from '../../core/navigation';
import {presenceFor} from '../../core/social/presence';
import {avatarUrlFor, fetchFriends} from '../../core/social/socialService';
import type {SocialProfile} from '../../core/social/types';
import {MenuDetailScreen} from '../menu/MenuDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'FriendsList'>;

export function FriendsListScreen({navigation}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [friends, setFriends] = useState<SocialProfile[] | null>(null);

  // Refetch each time the page is looked at, so a removal on a friend's profile
  // (or a new accept) is reflected on the way back.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      fetchFriends()
        .then(rows => {
          if (live) {
            setFriends(rows);
          }
        })
        .catch(() => {
          if (live) {
            setFriends(prev => prev ?? []);
          }
        });
      return () => {
        live = false;
      };
    }, []),
  );

  return (
    <MenuDetailScreen
      title={t('profile.friendsButton')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      {friends === null ? (
        <Skeleton height={160} />
      ) : friends.length === 0 ? (
        <GlassCard style={styles.messageCard}>
          <Text variant="secondary" color="secondary" align="center">
            {t('social.empty')}
          </Text>
        </GlassCard>
      ) : (
        friends.map(friend => {
          const presence = presenceFor(friend.lastSeenAt, Date.now());
          return (
            <Pressable
              key={friend.userId}
              onPress={() => navigation.navigate('FriendProfile', {profile: friend})}
              accessibilityRole="button"
              accessibilityLabel={friend.displayName}>
              <GlassCard style={styles.row}>
                <View>
                  <Avatar
                    initials={initialsFor(friend.displayName)}
                    tone="soft"
                    size={44}
                    uri={avatarUrlFor(friend.avatarPath)}
                  />
                  {presence.online ? <View style={styles.onlineDot} /> : null}
                </View>
                <Text variant="label" numberOfLines={1} style={styles.name}>
                  {friend.displayName}
                </Text>
                <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
              </GlassCard>
            </Pressable>
          );
        })
      )}
    </MenuDetailScreen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    body: {gap: spacing.sm},
    messageCard: {padding: spacing.xl},
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    name: {flex: 1},
    // Instagram-style presence dot pinned to the avatar corner, rimmed in the
    // card surface so it reads on the glass (same recipe as PersonCard).
    onlineDot: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.success,
      borderWidth: 2,
      borderColor: c.surface,
    },
  });
