/**
 * The Instagram-style identity block shared by the own Profile tab and a
 * friend's profile page: initials avatar on the left, then the name with the
 * presence and friends lines stacked beside it, and a slot for actions below
 * (the friend page puts its Friends/Invite buttons there). Sits directly on
 * the page background — no card, no shadow — so it reads as the page's
 * identity, not another card in the list.
 */
import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Avatar, Text, initialsFor} from '../../core/ui';
import {fonts, spacing, useThemedStyles, type Palette} from '../../theme';
import type {Presence} from '../../core/social/presence';
import {formatLastActive} from '../social/PersonCard';

type Props = {
  name: string;
  /** Own page: accent (it's you). Friend page: soft — mirrors PersonCard. */
  tone: 'accent' | 'soft';
  /** Hidden while null (offline, stranger, or the RPC not deployed yet). */
  friendCount: number | null;
  /** Own page only — the friends line becomes a tap into the Friends tab. */
  onPressFriends?: () => void;
  /** Own page only — the name itself becomes the rename tap target. */
  onEditName?: () => void;
  /** The profile picture URL, or null for the initials fallback. */
  avatarUri?: string | null;
  /** Own page only — tapping the avatar picks a new profile picture. */
  onPressAvatar?: () => void;
  /** The friend page's nav header already carries the name, so it hides the
   * name beside the avatar (own page keeps it — it's the rename target). */
  showName?: boolean;
  /** Friend page only — the online dot on the avatar + "Active X ago" line. */
  presence?: Presence;
  /** The action row under the identity (friend page: Friends + Invite). */
  children?: React.ReactNode;
};

export function ProfileHeader({
  name,
  tone,
  friendCount,
  onPressFriends,
  onEditName,
  avatarUri,
  onPressAvatar,
  presence,
  showName = true,
  children,
}: Props) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const activeLabel = presence ? formatLastActive(presence, t) : null;

  const nameText = (
    <Text style={styles.name} numberOfLines={1}>
      {name}
    </Text>
  );

  const friendsLabel =
    friendCount === null ? null : t('profile.friendsCount', {count: friendCount});

  const friendsText = friendsLabel ? (
    <Text variant="secondary" color="secondary">
      {friendsLabel}
    </Text>
  ) : null;

  return (
    <View style={styles.root}>
      <View style={styles.identityRow}>
        {/* Own page: the avatar is the tap target for choosing a picture.
            Friend page (no onPressAvatar): plain, non-tappable. */}
        {onPressAvatar ? (
          <Pressable
            onPress={onPressAvatar}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('profile.editAvatarA11y')}>
            <Avatar
              initials={initialsFor(name)}
              tone={tone}
              size={72}
              uri={avatarUri}
            />
            {presence?.online ? (
              <View
                style={styles.onlineDot}
                accessibilityLabel={t('social.a11yOnline')}
              />
            ) : null}
          </Pressable>
        ) : (
          <View>
            <Avatar
              initials={initialsFor(name)}
              tone={tone}
              size={72}
              uri={avatarUri}
            />
            {presence?.online ? (
              <View
                style={styles.onlineDot}
                accessibilityLabel={t('social.a11yOnline')}
              />
            ) : null}
          </View>
        )}

        <View style={styles.info}>
          {showName ? (
            onEditName ? (
              // The name itself is the (undecorated) tap target for renaming.
              <Pressable
                onPress={onEditName}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('profile.editNameA11y')}>
                {nameText}
              </Pressable>
            ) : (
              nameText
            )
          ) : null}

          {activeLabel ? (
            <Text variant="caption" color="tertiary">
              {activeLabel}
            </Text>
          ) : null}

          {friendsLabel ? (
            onPressFriends ? (
              <Pressable
                onPress={onPressFriends}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={friendsLabel}>
                {friendsText}
              </Pressable>
            ) : (
              friendsText
            )
          ) : null}
        </View>
      </View>

      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      paddingTop: spacing.sm,
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    info: {
      flex: 1,
      gap: spacing.xs,
    },
    // The scale's cap (medium 20) — the same size the wordmark uses, because the
    // name IS this page's headline.
    name: {
      fontFamily: fonts.medium,
      fontSize: 20,
      lineHeight: 24,
      color: c.ink,
    },
    // Same presence trick as PersonCard, scaled for the 72pt disc.
    onlineDot: {
      position: 'absolute',
      right: 2,
      bottom: 2,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: c.success,
      borderWidth: 2.5,
      borderColor: c.surface,
    },
    actions: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
  });
