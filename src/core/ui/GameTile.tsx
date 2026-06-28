import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {colors, radii, spacing} from '../../theme';
import {Text} from './Text';
import type {GameManifest} from '../games/types';

type GameTileProps = {
  game: GameManifest;
  onPress: () => void;
};

/** A single game entry on the Home hub. */
export function GameTile({game, onPress}: GameTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled: !game.available}}
      onPress={game.available ? onPress : undefined}
      style={({pressed}) => [
        styles.tile,
        pressed && game.available && styles.pressed,
        !game.available && styles.unavailable,
      ]}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text variant="section">{game.title}</Text>
          <Text variant="secondary" color="textSecondary" style={styles.subtitle}>
            {game.subtitle}
          </Text>
        </View>
        {!game.available && (
          <Text variant="caption" color="textSecondary">
            Coming soon
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  pressed: {opacity: 0.85},
  unavailable: {opacity: 0.5},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: {flex: 1},
  subtitle: {marginTop: spacing.xs},
});
