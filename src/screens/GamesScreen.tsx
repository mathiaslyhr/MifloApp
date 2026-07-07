import React, {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {GameTile, IslandTabBar, Screen, Text, TabId, toast} from '../core/ui';
import {spacing} from '../theme';
import {useAppNavigation} from '../core/navigation';
import {createRoom, BackendUnavailableError} from '../core/rooms/roomService';
import {randomFootballName} from '../core/identity/funnyName';
import {GAMES, GAME_CATEGORIES, GameType} from './gamesCatalog';

type Props = {
  /** Switch tabs (the nav island). */
  onTabSelect?: (id: TabId) => void;
};

/**
 * Games — the hub on the rainbow canvas. A centered wordmark over a scrollable
 * stack of glass game tiles; the header stays put and the floating nav island
 * (Games active) sits over the content, which scrolls beneath it — same layout
 * language as the Menu page, so the catalog can grow without cramping.
 *
 * Tapping a single-player game opens straight to its screen; a multiplayer game
 * mints a party locked to that game and pushes the Lobby (mirrors Home's
 * Create). Unbuilt games render dimmed with a "Coming soon" pill and are inert.
 */
/** Space the list reserves at its foot so the last tile clears the floating island. */
const TAB_CLEARANCE = 96;

export function GamesScreen({onTabSelect}: Props) {
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
    // Drop the bottom safe-area edge so content scrolls all the way under the
    // floating island (the island manages the bottom inset itself).
    <Screen canvas edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text variant="wordmark" align="center">
          {t('games.title')}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.list,
          {paddingBottom: insets.bottom + TAB_CLEARANCE},
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

      {/* Floating overlay — pinned above the content, translucent so the list
          scrolls under it. `box-none` lets scroll gestures pass through the
          empty areas beside the pill. */}
      <View
        style={[styles.tabOverlay, {paddingBottom: insets.bottom}]}
        pointerEvents="box-none">
        <IslandTabBar active="games" onSelect={onTabSelect} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.sm,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {flex: 1},
  list: {
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  group: {
    gap: spacing.md,
  },
  tabOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
