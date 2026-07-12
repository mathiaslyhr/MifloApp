/**
 * The profile "showcase": a user's favorite footballer, club and national team,
 * shown as three little badges under the identity block. Editable on your own
 * Profile (each tile opens a search picker; a set tile can be changed or
 * cleared), read-only on a friend's page — where the whole card hides if they
 * have picked none.
 *
 * Favorites are the dataset's stable ids (footballer id, club slug, nation
 * string); art and names resolve here at render time via the same bundled
 * flag/crest/portrait maps the games use. Persistence is the parent's job: this
 * component only reports the new favorites triple through `onChange`, so the own
 * Profile keeps the one optimistic-update path (mirroring the avatar flow).
 */
import React, {useState} from 'react';
import {ActionSheetIOS, Image, Pressable, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Plus} from 'lucide-react-native';
import {GlassCard, Text} from '../../core/ui';
import {
  fonts,
  radii,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../../theme';
import {CLUBS, FOOTBALLERS, derivedFromData, getById, getClub} from '../../data/football';
import {flagImage, logoImage} from '../../games/hattrick/criterionIcon';
import {PLAYER_AVATARS} from '../../games/hattrick/assets/playerAvatars';
import {fold} from '../../games/hattrick/playerSearch';
import {FootballerSearchModal} from '../../games/shared/FootballerSearchModal';
import {
  EntityPickerModal,
  type EntityOption,
} from '../../games/shared/EntityPickerModal';

/** The three showcase picks; null for an unset slot. */
export type Favorites = {
  playerId: string | null;
  clubId: string | null;
  nation: string | null;
};

type Props = {
  favorites: Favorites;
  /** Own profile: tiles open pickers. Friend profile: read-only. */
  editable?: boolean;
  /** Own profile only — the full new triple after a pick or a clear. */
  onChange?: (next: Favorites) => void;
};

type Slot = 'player' | 'club' | 'nation';

// Searchable pools for the club/nation pickers, memoized against OTA hydration
// (CLUBS/FOOTBALLERS mutate in place). Nations are limited to those with a
// bundled flag so every row shows art.
const clubOptions = derivedFromData<EntityOption[]>(() =>
  CLUBS.map(c => ({
    id: c.id,
    label: c.name,
    flag: logoImage(c.id) ?? undefined,
    searchTexts: [fold(c.name)],
  })),
);

const nationOptions = derivedFromData<EntityOption[]>(() =>
  [...new Set(FOOTBALLERS.flatMap(f => f.nationality))]
    .filter(n => flagImage(n) != null)
    .sort()
    .map(n => ({
      id: n,
      label: n,
      flag: flagImage(n) ?? undefined,
      searchTexts: [fold(n)],
    })),
);

/** Portrait for a footballer id, falling back to their nationality flag. */
function playerImage(id: string): number | null {
  return PLAYER_AVATARS[id] ?? flagImage(getById(id)?.nationality[0]) ?? null;
}

export function FavoritesShowcase({favorites, editable = false, onChange}: Props) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [editing, setEditing] = useState<Slot | null>(null);

  const playerName = favorites.playerId
    ? getById(favorites.playerId)?.name ?? favorites.playerId
    : null;
  const clubName = favorites.clubId
    ? getClub(favorites.clubId)?.name ?? favorites.clubId
    : null;

  // A friend with nothing to show gets no card at all.
  const isEmpty = !favorites.playerId && !favorites.clubId && !favorites.nation;
  if (!editable && isEmpty) {
    return null;
  }

  function set(slot: Slot, id: string | null) {
    if (!onChange) {
      return;
    }
    if (slot === 'player') {
      onChange({...favorites, playerId: id});
    } else if (slot === 'club') {
      onChange({...favorites, clubId: id});
    } else {
      onChange({...favorites, nation: id});
    }
  }

  /** Tap a tile: empty → open the picker; set → change or remove (avatar UX). */
  function onTilePress(slot: Slot, hasValue: boolean) {
    if (!editable) {
      return;
    }
    if (!hasValue) {
      setEditing(slot);
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          t('profile.favoriteChange'),
          t('profile.favoriteRemove'),
          t('common.cancel'),
        ],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      index => {
        if (index === 0) {
          setEditing(slot);
        } else if (index === 1) {
          set(slot, null);
        }
      },
    );
  }

  return (
    <GlassCard style={styles.card}>
      <Text variant="label" color="secondary" style={styles.title}>
        {t('profile.showcaseTitle')}
      </Text>
      <View style={styles.row}>
        <Tile
          caption={t('profile.favoritePlayer')}
          label={playerName}
          image={favorites.playerId ? playerImage(favorites.playerId) : null}
          editable={editable}
          onPress={() => onTilePress('player', !!favorites.playerId)}
        />
        <Tile
          caption={t('profile.favoriteClub')}
          label={clubName}
          image={favorites.clubId ? logoImage(favorites.clubId) : null}
          editable={editable}
          onPress={() => onTilePress('club', !!favorites.clubId)}
        />
        <Tile
          caption={t('profile.favoriteNation')}
          label={favorites.nation}
          image={favorites.nation ? flagImage(favorites.nation) : null}
          editable={editable}
          onPress={() => onTilePress('nation', !!favorites.nation)}
        />
      </View>

      {editable ? (
        <>
          <FootballerSearchModal
            visible={editing === 'player'}
            title={t('profile.favoritePlayerPick')}
            placeholder={t('profile.favoriteSearchPlaceholder')}
            hint={t('profile.favoritePlayerHint')}
            empty={t('profile.favoriteEmpty')}
            onPick={id => {
              set('player', id);
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
          />
          <EntityPickerModal
            visible={editing === 'club'}
            title={t('profile.favoriteClubPick')}
            placeholder={t('profile.favoriteSearchPlaceholder')}
            hint={t('profile.favoriteClubHint')}
            empty={t('profile.favoriteEmpty')}
            options={clubOptions()}
            onPick={id => {
              set('club', id);
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
          />
          <EntityPickerModal
            visible={editing === 'nation'}
            title={t('profile.favoriteNationPick')}
            placeholder={t('profile.favoriteSearchPlaceholder')}
            hint={t('profile.favoriteNationHint')}
            empty={t('profile.favoriteEmpty')}
            options={nationOptions()}
            onPick={id => {
              set('nation', id);
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
          />
        </>
      ) : null}
    </GlassCard>
  );
}

function Tile({
  caption,
  label,
  image,
  editable,
  onPress,
}: {
  caption: string;
  label: string | null;
  image: number | null;
  editable: boolean;
  onPress: () => void;
}) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const a11y = label
    ? `${caption}, ${label}`
    : editable
      ? t('profile.favoriteAddA11y', {slot: caption})
      : caption;

  const body = (
    <View style={styles.tile}>
      <View style={styles.badge}>
        {image != null ? (
          <Image source={image} resizeMode="contain" style={styles.badgeImg} />
        ) : editable ? (
          <Plus size={18} color={colors.textTertiary} strokeWidth={2} />
        ) : (
          <Text variant="caption" color="tertiary">
            —
          </Text>
        )}
      </View>
      <Text variant="caption" color="tertiary" numberOfLines={1} style={styles.caption}>
        {caption}
      </Text>
      {label ? (
        <Text variant="secondary" numberOfLines={1} style={styles.label}>
          {label}
        </Text>
      ) : (
        <Text
          variant="secondary"
          color="tertiary"
          numberOfLines={1}
          style={styles.label}>
          {editable ? t('profile.favoriteAdd') : '—'}
        </Text>
      )}
    </View>
  );

  if (!editable) {
    return body;
  }
  return (
    <Pressable
      style={styles.tilePress}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}>
      {body}
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    title: {letterSpacing: 0.3},
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    tilePress: {flex: 1},
    tile: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs,
    },
    badge: {
      width: 56,
      height: 56,
      borderRadius: radii.card,
      backgroundColor: c.surface2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    badgeImg: {width: 40, height: 40},
    caption: {
      fontFamily: fonts.medium,
      letterSpacing: 0.2,
    },
    label: {textAlign: 'center'},
  });
