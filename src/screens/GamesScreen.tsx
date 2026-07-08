import React, {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {
  GameTile,
  NAV_HEIGHT,
  Screen,
  Text,
  toast,
  TopStatusFade,
} from '../core/ui';
import {spacing} from '../theme';
import {useAppNavigation} from '../core/navigation';
import {createRoom, BackendUnavailableError} from '../core/rooms/roomService';
import {randomFootballName} from '../core/identity/funnyName';
import {GAMES, GameType} from './gamesCatalog';

/**
 * Games — the hub on the rainbow canvas. The wordmark header is the first item
 * in the scroll content, so it slides up and off the top as you scroll
 * (Instagram-style); only a faint blurred status strip stays pinned. The shared
 * nav island (in the tab shell) blurs the catalog beneath it.
 *
 * Tapping a single-player game opens straight to its screen; a multiplayer game
 * mints a party locked to that game and pushes the Lobby (mirrors Home's
 * Create). Unbuilt games render dimmed with a "Coming soon" pill and are inert.
 */
export function GamesScreen() {
  const {t} = useTranslation();
  const navigation = useAppNavigation();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  // Single-player games open straight to their screen; multiplayer games mint a
  // party locked to that game and hand off to the Lobby.
  async function handleSelect(gameType: GameType) {
    if (busy) {
      return;
    }
    if (GAMES.find(g => g.gameType === gameType)?.single) {
      if (gameType === 'scout') {
        navigation.navigate('Scout');
      }
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
    // Drop top/bottom safe-area edges — the scroll content owns the top inset
    // (the header scrolls away) and the shell nav owns the bottom inset.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: NAV_HEIGHT + insets.bottom + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Wordmark header — in the scroll flow, so it scrolls off the top. */}
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            {t('games.title')}
          </Text>
        </View>
        {/* One flat list — playable games first (each with an audience chip),
            then "coming soon" games dimmed at the bottom. No section headers. */}
        <View style={styles.group}>
          {GAMES.map(game => (
            <GameTile
              key={game.gameType}
              title={t(`games.${game.i18nKey}.title`)}
              tagline={t(`games.${game.i18nKey}.tagline`)}
              Icon={game.Icon}
              disabled={!game.available}
              meta={game.available ? t(`games.audience.${game.category}`) : undefined}
              badge={game.available ? undefined : t('games.comingSoon')}
              badgeVariant="text"
              onPress={() => handleSelect(game.gameType)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Seamless frosted fade behind the status bar — content dissolves under
          it (no hard edge) as it scrolls up. */}
      <TopStatusFade />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {flex: 1},
  list: {
    gap: spacing.lg,
  },
  group: {
    gap: spacing.md,
  },
});
