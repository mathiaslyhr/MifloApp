/**
 * The secret footballer, shown to detectives at role reveal and to everyone at
 * the end. The secret is always drawn from the illustrated set (see
 * `engine.eligibleFootballerIds`), so the portrait is guaranteed to exist; flag,
 * current-club crest and position round out the card.
 */
import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {Text} from '../../core/ui';
import {spacing, useThemedStyles, type Palette} from '../../theme';
import {getById, POSITION_LABELS} from '../../data/football';
import {flagImage, logoImage} from '../hattrick/criterionIcon';
import {PLAYER_AVATARS} from '../hattrick/assets/playerAvatars';

export function FootballerCard({footballerId}: {footballerId: string}) {
  const styles = useThemedStyles(makeStyles);
  const f = getById(footballerId);
  if (!f) {
    return null;
  }
  const portrait = PLAYER_AVATARS[footballerId] ?? null;
  const flag = flagImage(f.nationality[0]);
  // "Current" club: the most recent spell in the list.
  const clubId = f.clubs.length ? f.clubs[f.clubs.length - 1].clubId : undefined;
  const crest = logoImage(clubId);
  const position = f.positions.map(p => POSITION_LABELS[p]).join(' · ');

  return (
    // Chromeless: just the stacked content — the caller supplies any framing
    // (a frosted card, a green/red reveal frame, etc.).
    <View style={styles.content}>
      {portrait != null ? (
        <Image source={portrait} resizeMode="contain" style={styles.portrait} />
      ) : null}
      <Text variant="section" align="center" numberOfLines={2} style={styles.name}>
        {f.name}
      </Text>
      <View style={styles.metaRow}>
        {flag != null ? (
          <Image source={flag} resizeMode="contain" style={styles.flag} />
        ) : null}
        {crest != null ? (
          <Image source={crest} resizeMode="contain" style={styles.crest} />
        ) : null}
        <Text variant="secondary" color="secondary">
          {position}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  portrait: {width: 132, height: 132},
  name: {color: c.ink},
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flag: {width: 24, height: 18, borderRadius: 2},
  crest: {width: 22, height: 22},
});
