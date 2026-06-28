import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Avatar, Badge, Icon, Text} from '../../../core/ui';
import {colors, spacing} from '../../../theme';
import {formatPoints} from '../mockData';
import type {Standing} from '../scoring';

type StandingRowProps = {
  standing: Standing;
  divider?: boolean;
};

/** One leaderboard line: rank, avatar, name, movement arrow, points. */
export function StandingRow({standing, divider = true}: StandingRowProps) {
  const {rank, contestant, movement} = standing;
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <Text variant="body" color="textSecondary" style={styles.rank}>
        {rank}
      </Text>
      <Avatar
        name={contestant.name}
        variant={contestant.isYou ? 'host' : 'neutral'}
        size={36}
      />
      <Text variant="body" style={styles.name} numberOfLines={1}>
        {contestant.name}
      </Text>
      {contestant.isYou && <Badge label="you" tone="you" />}
      <Movement movement={movement} />
      <Text variant="body" style={styles.points}>
        {formatPoints(contestant.score)}
      </Text>
    </View>
  );
}

function Movement({movement}: {movement: Standing['movement']}) {
  if (movement === 'up') {
    return <Icon name="chevron-up" size={18} color="success" />;
  }
  if (movement === 'down') {
    return <Icon name="chevron-down" size={18} color="error" />;
  }
  return <View style={styles.dash} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rank: {
    width: 20,
    textAlign: 'center',
  },
  name: {
    flex: 1,
  },
  points: {
    fontWeight: '500',
    minWidth: 56,
    textAlign: 'right',
  },
  dash: {
    width: 10,
    height: StyleSheet.hairlineWidth + 1,
    backgroundColor: colors.textSecondary,
    borderRadius: 1,
  },
});
