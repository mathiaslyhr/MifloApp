import React, {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {ChevronLeft} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  CircleButton,
  FloatingBar,
  GameTile,
  Screen,
  Text,
  TopStatusFade,
} from '../core/ui';
import {screenPadding, spacing, useColors} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {GAMES, GameType} from './gamesCatalog';

type Props = NativeStackScreenProps<RootStackParamList, 'GamePicker'>;

/**
 * The host's game picker — the Games-hub layout on a real pushed page instead of
 * a dimmed modal. Same rainbow canvas, scroll-away wordmark header, and full
 * glass tiles, but with a pinned floating back button in place of the nav island
 * (this sits on top of the tab shell, so no navbar shows). Only multiplayer games
 * appear; the choice is handed back to the Lobby, which owns starting the round.
 */
export function GamePickerScreen({route, navigation}: Props) {
  const {roomId, onPick} = route.params;
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [busy, setBusy] = useState(false);

  // Build the round via the Lobby's startGame, then REPLACE this page with the
  // game screen — so the host goes picker → game with no lobby flash in between,
  // and the stack stays Lobby → game (the game's back button still lands here's
  // parent). While the write is in flight the tiles disable. On a blocked/failed
  // start (e.g. too few players) startGame resolves undefined; we just pop back.
  async function handleSelect(gameType: GameType) {
    if (busy) {
      return;
    }
    setBusy(true);
    const target = await onPick(gameType);
    if (target === 'Hattrick') {
      navigation.replace('Hattrick', {roomId});
    } else if (target === 'RedCard') {
      navigation.replace('RedCard', {roomId});
    } else if (target === 'Offside') {
      navigation.replace('Offside', {roomId});
    } else if (target === 'CultHero') {
      navigation.replace('CultHero', {roomId});
    } else {
      setBusy(false);
      navigation.goBack();
    }
  }

  return (
    // Drop top/bottom safe-area edges — the scroll content owns the top inset
    // (the header scrolls away); there's no bottom bar to own the bottom inset.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Wordmark header — in the scroll flow, so it scrolls off the top. */}
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            {t('lobby.pickTitle')}
          </Text>
        </View>
        {/* Only multiplayer games — a party can't launch a solo game. Mirrors the
            Games hub: audience chip up front, unbuilt games dimmed at the bottom. */}
        <View style={styles.group}>
          {GAMES.filter(game => !game.single).map(game => (
            <GameTile
              key={game.gameType}
              title={t(`games.${game.i18nKey}.title`)}
              tagline={t(`games.${game.i18nKey}.tagline`)}
              Icon={game.Icon}
              disabled={!game.available || busy}
              meta={game.available ? t(`games.audience.${game.category}`) : undefined}
              badge={game.available ? undefined : t('games.comingSoon')}
              badgeVariant="text"
              onPress={() => handleSelect(game.gameType)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Pinned floating back button (top-left) — stays reachable while the
          wordmark scrolls away, mirroring the Lobby's floating corner button. */}
      <FloatingBar edge="top" style={styles.backBar}>
        <View style={styles.backRow}>
          <CircleButton
            size={36}
            accessibilityLabel={t('common.back')}
            onPress={() => navigation.goBack()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        </View>
      </FloatingBar>

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
  // Pinned floating back button, aligned to the wordmark's row.
  backBar: {paddingHorizontal: screenPadding},
  backRow: {
    height: 44,
    marginTop: spacing.sm,
    justifyContent: 'center',
    alignItems: 'flex-start',
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
