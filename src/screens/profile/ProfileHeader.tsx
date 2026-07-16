/**
 * The Instagram-style identity block shared by the own Profile tab and a
 * friend's profile page: initials avatar on the left, then the name with the
 * presence and friends lines stacked beside it, and a slot for actions below
 * (the friend page puts its Friends/Invite buttons there). Sits directly on
 * the page background — no card, no shadow — so it reads as the page's
 * identity, not another card in the list.
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Avatar, PressableScale, Text, initialsFor} from '../../core/ui';
import {fonts, onRim, spacing, useThemedStyles, type Palette} from '../../theme';
import {lastActiveParts, type ActiveUnit, type Presence} from '../../core/social/presence';
import {formatLastActive} from '../social/PersonCard';

/** The caption under an "active" stat, per unit. */
const AGO_KEY: Record<ActiveUnit, string> = {
  minutes: 'profile.agoMinutes',
  hours: 'profile.agoHours',
  days: 'profile.agoDays',
};

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

  // The Instagram stat: the number is the thing you read, the unit under it is
  // just its unit. The full phrase stays the a11y label, so a screen reader
  // still hears "12 friends" rather than a stray number and a stray noun.
  const friendsLabel =
    friendCount === null ? null : t('profile.friendsCount', {count: friendCount});

  const active = presence ? lastActiveParts(presence) : null;

  return (
    <View style={styles.root}>
      <View style={styles.identityRow}>
        {/* Own page: the avatar is the tap target for choosing a picture.
            Friend page (no onPressAvatar): plain, non-tappable. */}
        {onPressAvatar ? (
          <PressableScale
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
          </PressableScale>
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
              <PressableScale
                onPress={onEditName}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('profile.editNameA11y')}>
                {nameText}
              </PressableScale>
            ) : (
              nameText
            )
          ) : null}

          {/* A stat row under the name, Instagram's shape: each is a number
              read big over its unit. Only the friends stat is inside a
              Pressable, so the tap target is exactly as wide as the thing that
              goes somewhere — "active" is a fact, not a door.

              Active is absent while they're online, because then the green dot
              on the avatar is already saying it, and "0 min ago" is a worse way
              to say "now". */}
          {friendCount !== null || active ? (
            <View style={styles.metaRow}>
              {friendCount !== null ? (
                onPressFriends ? (
                  <PressableScale
                    onPress={onPressFriends}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={friendsLabel ?? undefined}>
                    <Stat
                      value={friendCount}
                      unit={t('profile.friendsStat', {count: friendCount})}
                      tone="link"
                    />
                  </PressableScale>
                ) : (
                  <Stat
                    value={friendCount}
                    unit={t('profile.friendsStat', {count: friendCount})}
                    tone="link"
                  />
                )
              ) : null}
              {active ? (
                <Stat
                  value={active.value}
                  unit={t(AGO_KEY[active.unit], {count: active.value})}
                  tone="quiet"
                  accessibilityLabel={activeLabel ?? undefined}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

/**
 * One Instagram-style stat: the number, read big, over the unit it counts.
 * `link` wears the brand because it goes somewhere; `quiet` is a plain fact and
 * must not, or the colour stops meaning "tappable".
 */
function Stat({
  value,
  unit,
  tone,
  accessibilityLabel,
}: {
  value: number;
  unit: string;
  tone: 'link' | 'quiet';
  accessibilityLabel?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View
      style={styles.stat}
      accessible
      accessibilityLabel={accessibilityLabel ?? `${value} ${unit}`}>
      <Text style={[styles.statValue, tone === 'quiet' && styles.statValueQuiet]}>
        {value}
      </Text>
      <Text variant="caption" color="tertiary">
        {unit}
      </Text>
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
    // Name, then one meta line: the friends stat and how recently they were
    // here. Wraps rather than truncates — a long "Active 3 days ago" beside the
    // stat doesn't fit every phone.
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: spacing.lg,
    },
    // Instagram's stat block: the number carries, the noun is its unit.
    stat: {alignItems: 'flex-start'},
    statValue: {
      fontFamily: fonts.medium,
      fontSize: 17,
      lineHeight: 21,
      // The friends stat is the one tappable thing in the block, so it wears
      // the brand. primaryInk, not primary: a step lighter, which is what small
      // accent text on the dark canvas needs to stay legible.
      color: c.primaryInk,
      fontVariant: ['tabular-nums'],
    },
    statValueQuiet: {color: c.ink},
    // The scale's cap (medium 20) — the same size the wordmark uses, because the
    // name IS this page's headline.
    name: {
      fontFamily: fonts.medium,
      fontSize: 20,
      lineHeight: 24,
      color: c.ink,
    },
    // Presence dot, centred ON the avatar's outline at the 45° point. No rim:
    // a rounded border over a coloured background leaves an anti-aliased fringe
    // of that background outside it, so the dot read as a green ring around a
    // dark ring around a green dot.
    onlineDot: {
      position: 'absolute',
      right: onRim(72, 9),
      bottom: onRim(72, 9),
      width: 9,
      height: 9,
      borderRadius: 4.5,
      backgroundColor: c.success,
    },
    actions: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
  });
