import React, {useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
// Gesture-handler's ScrollView, so the tiles' swipe-right pan and the vertical
// scroll arbitrate natively (whichever wins cancels the other cleanly).
import {ScrollView} from 'react-native-gesture-handler';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {
  CircleButton,
  GameTile,
  NAV_HEIGHT,
  Screen,
  Text,
  toast,
  TopStatusFade,
} from '../core/ui';
import {colors, spacing} from '../theme';
import {useAppNavigation} from '../core/navigation';
import {Smartphone} from 'lucide-react-native';
import {createRoom, BackendUnavailableError} from '../core/rooms/roomService';
import {randomFootballName} from '../core/identity/funnyName';
import {GAMES, GameType} from './gamesCatalog';

/** Roomless pass-and-play routes for the games that support "On this phone". */
const LOCAL_ROUTES = {
  hattrick: 'HattrickLocal',
  'red-card': 'RedCardLocal',
  offside: 'OffsideLocal',
  'cult-hero': 'CultHeroLocal',
} as const;

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
  // Handed to each tile so its swipe-right pan outranks the vertical scroll
  // (the scroll waits until the pan has failed).
  const scrollRef = useRef<ScrollView>(null);

  // Single-player games open straight to their screen; multiplayer games mint a
  // party locked to that game and hand off to the Lobby. Pass-and-play capable
  // games additionally carry a small phone button on the tile (see below) as a
  // quiet side door — tapping the tile itself always goes online.
  async function handleSelect(gameType: GameType) {
    if (busy) {
      return;
    }
    if (GAMES.find(g => g.gameType === gameType)?.single) {
      if (gameType === 'scout') {
        navigation.navigate('Scout');
      } else if (gameType === 'tenball') {
        navigation.navigate('TopBins');
      } else if (gameType === 'journeyman') {
        navigation.navigate('Journeyman');
      } else if (gameType === 'teamsheet') {
        navigation.navigate('Teamsheet');
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

  // The tile's phone button: straight into pass-and-play, no room, no network.
  function startLocal(gameType: GameType) {
    const route = LOCAL_ROUTES[gameType as keyof typeof LOCAL_ROUTES];
    if (route) {
      navigation.navigate(route);
    }
  }

  return (
    // Drop top/bottom safe-area edges — the scroll content owns the top inset
    // (the header scrolls away) and the shell nav owns the bottom inset.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: NAV_HEIGHT + insets.bottom + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Wordmark header — in the scroll flow, so it scrolls off the top.
            The corner phone button (mirrors Home's "?") opens the One device
            page, the signpost for the swipe-right pass-and-play gesture. */}
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            {t('games.title')}
          </Text>
          <View style={styles.headerRight}>
            <CircleButton
              size={30}
              accessibilityLabel={t('oneDevice.title')}
              onPress={() => navigation.navigate('OneDevice')}>
              <Smartphone size={15} color={colors.textSecondary} strokeWidth={2} />
            </CircleButton>
          </View>
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
              daily={game.available && game.daily ? t('games.daily') : undefined}
              badge={game.available ? undefined : t('games.comingSoon')}
              badgeVariant="text"
              onPress={() => handleSelect(game.gameType)}
              SecondaryIcon={game.localPlay ? Smartphone : undefined}
              onSecondaryPress={
                game.localPlay ? () => startLocal(game.gameType) : undefined
              }
              secondaryAccessibilityLabel={t('games.localPlay')}
              secondaryLabel={t('games.oneDeviceShort')}
              scrollRef={scrollRef}
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
  // Corner action pinned to the header row's right edge (mirrors Home's "?").
  headerRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  scroll: {flex: 1},
  list: {
    gap: spacing.lg,
  },
  // Extra gap so the audience pill overhanging each tile's top edge clears the
  // tile stacked above it.
  group: {
    gap: spacing.xl,
  },
});
