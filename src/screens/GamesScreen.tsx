import React, {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {
  FloatingBar,
  GameTile,
  IslandTabBar,
  Screen,
  Text,
  TabId,
  toast,
} from '../core/ui';
import {screenPadding, spacing} from '../theme';
import {useAppNavigation} from '../core/navigation';
import {createRoom, BackendUnavailableError} from '../core/rooms/roomService';
import {randomFootballName} from '../core/identity/funnyName';
import {GAMES, GAME_CATEGORIES, GameType} from './gamesCatalog';

type Props = {
  /** Switch tabs (the nav island). */
  onTabSelect?: (id: TabId) => void;
};

/**
 * Games — the hub on the rainbow canvas. A centered wordmark floats at the top
 * and the nav island (Games active) floats at the bottom; the stack of glass
 * game tiles scrolls the full height *behind* both, with no fixed chrome or clip
 * line — the app-wide floating-bar layout, shared with Menu and Lobby.
 *
 * Tapping a single-player game opens straight to its screen; a multiplayer game
 * mints a party locked to that game and pushes the Lobby (mirrors Home's
 * Create). Unbuilt games render dimmed with a "Coming soon" pill and are inert.
 */
export function GamesScreen({onTabSelect}: Props) {
  const {t} = useTranslation();
  const navigation = useAppNavigation();
  const [busy, setBusy] = useState(false);
  // Floating-bar heights, measured at layout, so the scroll content can reserve
  // matching top/bottom clearance and glide behind the chrome.
  const [topH, setTopH] = useState(0);
  const [botH, setBotH] = useState(0);

  // Single-player games open straight to their screen; multiplayer games mint a
  // party locked to that game and hand off to the Lobby.
  async function handleSelect(gameType: GameType) {
    if (busy) {
      return;
    }
    if (GAMES.find(g => g.gameType === gameType)?.single) {
      if (gameType === 'mystery-footballer') {
        navigation.navigate('MysteryFootballer');
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
    // Drop top/bottom safe-area edges — the floating bars own those insets so
    // the catalog scrolls the full height, behind the chrome, with no clip line.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.list,
          {paddingTop: topH + spacing.xl, paddingBottom: botH + spacing.xl},
        ]}
        showsVerticalScrollIndicator={false}>
        {GAME_CATEGORIES.map(({category, i18nKey}) => {
          const games = GAMES.filter(g => g.category === category);
          if (games.length === 0) {
            return null;
          }
          return (
            <View key={category}>
              <Text variant="section" style={styles.sectionHeader}>
                {t(`games.categories.${i18nKey}`)}
              </Text>
              <View style={styles.group}>
                {games.map(game => (
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
            </View>
          );
        })}
      </ScrollView>

      {/* Floating header — the wordmark, no background; the catalog scrolls
          behind it. */}
      <FloatingBar edge="top" onHeight={setTopH} style={styles.topBar}>
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            {t('games.title')}
          </Text>
        </View>
      </FloatingBar>

      {/* Floating nav island (Games active), pinned to the bottom. */}
      <FloatingBar edge="bottom" onHeight={setBotH}>
        <IslandTabBar active="games" onSelect={onTabSelect} />
      </FloatingBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // FloatingBar spans edge-to-edge; pad it so the wordmark lines up with the
  // 16px-inset scrolled content.
  topBar: {
    paddingTop: spacing.sm,
    paddingHorizontal: screenPadding,
  },
  scroll: {flex: 1},
  list: {
    gap: spacing.lg,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  group: {
    gap: spacing.md,
  },
});
