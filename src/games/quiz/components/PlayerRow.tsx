import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Avatar, Badge, Text} from '../../../core/ui';
import {colors, spacing} from '../../../theme';
import type {Player} from '../mockData';

type PlayerRowProps = {
  player: Player;
  /** Draw the bottom hairline separator. */
  divider?: boolean;
};

/** A single lobby player: avatar, name, and a `host` badge for the host. */
export function PlayerRow({player, divider = true}: PlayerRowProps) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <Avatar name={player.name} variant={player.isHost ? 'host' : 'neutral'} />
      <Text variant="body" style={styles.name}>
        {player.name}
      </Text>
      {player.isHost && <Badge label="host" tone="host" />}
    </View>
  );
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
  name: {
    flex: 1,
  },
});
