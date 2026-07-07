import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {GameTile, IslandTabBar, Screen, Text, TabId, toast} from '../core/ui';
import {spacing} from '../theme';
import {useAppNavigation} from '../core/navigation';
import {createRoom, BackendUnavailableError} from '../core/rooms/roomService';
import {randomFootballName} from '../core/identity/funnyName';
import {GAMES, GameType} from './gamesCatalog';

type Props = {
  /** Switch tabs (the nav island). */
  onTabSelect?: (id: TabId) => void;
};

/**
 * Games — the hub on the rainbow canvas. A left-aligned header over a stack of
 * glass game tiles; the floating nav island (Games active) anchors the bottom.
 *
 * Tapping a built game mints a party locked to that game and pushes the Lobby
 * (mirrors Home's Create). Unbuilt games render dimmed with a "Coming soon"
 * pill and don't respond to taps.
 */
export function GamesScreen({onTabSelect}: Props) {
  const {t} = useTranslation();
  const navigation = useAppNavigation();
  const [busy, setBusy] = useState(false);

  // Create a room locked to the tapped game, then hand off to the Lobby.
  async function handleSelect(gameType: GameType) {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const room = await createRoom(gameType, [], 0, randomFootballName());
      navigation.navigate('Lobby', {roomId: room.id});
    } catch (err) {
      toast.error(
        err instanceof BackendUnavailableError
          ? t('home.errorUnavailable')
          : t('home.errorCreate'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen canvas>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            {t('games.title')}
          </Text>
        </View>

        <View style={styles.topSpacer} />

        <View style={styles.list}>
          {GAMES.map(game => (
            <GameTile
              key={game.gameType}
              title={t(`games.${game.i18nKey}.title`)}
              tagline={t(`games.${game.i18nKey}.tagline`)}
              Icon={game.Icon}
              disabled={!game.available}
              badge={game.available ? undefined : t('games.comingSoon')}
              onPress={() => handleSelect(game.gameType)}
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
