import React from 'react';
import {StyleSheet, View} from 'react-native';
import {GameTile, IslandTabBar, Screen, Text, TabId} from '../core/ui';
import {spacing} from '../theme';
import {GAMES, GameType} from './gamesCatalog';

type Props = {
  /** Switch tabs (the nav island). */
  onTabSelect?: (id: TabId) => void;
  /** Open a game — its Create screen. Stubbed until those screens are built. */
  onSelectGame?: (gameType: GameType) => void;
};

/**
 * Games — the hub on the rainbow canvas. A left-aligned header over a stack of
 * glass game tiles; the floating nav island (Games active) anchors the bottom.
 *
 * Tapping a tile will open that game's Create screen once those exist; for now
 * `onSelectGame` is a no-op stub.
 */
export function GamesScreen({onTabSelect, onSelectGame}: Props) {
  return (
    <Screen canvas>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            Games
          </Text>
        </View>

        <View style={styles.topSpacer} />

        <View style={styles.list}>
          {GAMES.map(game => (
            <GameTile
              key={game.gameType}
              title={game.title}
              tagline={game.tagline}
              Icon={game.Icon}
              onPress={() => onSelectGame?.(game.gameType)}
            />
          ))}
        </View>

        <View style={styles.bottomSpacer} />

        <IslandTabBar active="games" onSelect={onTabSelect} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {flex: 1},
  header: {
    marginTop: spacing.sm,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Tiles sit ~a third down, mirroring Home's rhythm.
  topSpacer: {flex: 1},
  list: {gap: spacing.md},
  bottomSpacer: {flex: 1.7},
});
