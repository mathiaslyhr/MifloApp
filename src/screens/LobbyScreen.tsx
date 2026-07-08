import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import {ChevronLeft} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Button,
  CircleButton,
  FloatingBar,
  GlassCard,
  GlassTag,
  NameSheet,
  Screen,
  Text,
  TopStatusFade,
} from '../core/ui';
import {GAMES, isBuiltGame} from './gamesCatalog';
import {colors, radii, screenPadding, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {
  fetchPlayers,
  kickPlayer,
  leaveRoom,
  renamePlayer,
  startBoardGame,
  startRedCardGame,
  subscribePlayers,
  subscribeRoom,
} from '../core/rooms/roomService';
import {ensureSession} from '../core/supabase/client';
import {generateGrid, gridSignature} from '../games/hattrick/grid';
import {createIndividualState} from '../games/hattrick/engine';
import {buildFootballerPool} from '../games/red-card/engine';
import {MIN_PLAYERS as IMPOSTER_MIN} from '../games/red-card/types';
import type {Room, RoomPlayer} from '../core/rooms/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Lobby'>;

/**
 * Lobby — where players gather after a party is created. Shows the party code and
 * a live, Kahoot-style list of player names (no avatars). Tap your own name to
 * rename yourself for the round; the host taps another name to remove them. The
 * host later picks the game from here (stubbed — games aren't built).
 */
export function LobbyScreen({route, navigation}: Props) {
  const {roomId} = route.params;
  const {t} = useTranslation();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const insets = useSafeAreaInsets();
  // Measured height of the floating bottom bar, so scroll content clears it.
  const [botH, setBotH] = useState(0);

  // Track membership so we can detect being kicked (present → gone).
  const wasPresentRef = useRef(false);
  const kickedRef = useRef(false);
  // Guards the one-shot exit to the menu when the party closes (host left).
  const closedRef = useRef(false);
  // Guards the one-shot navigation into the game when it starts.
  const inGameRef = useRef(false);
  // Party-session memory (host device): who opened the last game and the last
  // few grids, so consecutive rounds don't repeat the starter or the board.
  const lastStarterRef = useRef<string | null>(null);
  const recentGridsRef = useRef<string[]>([]);

  useEffect(() => {
    ensureSession()
      .then(setMyUserId)
      .catch(() => {});
    const unsubPlayers = subscribePlayers(roomId, setPlayers);
    // Host left → the room is deleted; no host, no party. Return to the menu.
    const unsubRoom = subscribeRoom(roomId, setRoom, () => {
      if (!closedRef.current) {
        closedRef.current = true;
        navigation.popToTop();
      }
    });
    // Prime the roster once in case the realtime channel is slow to attach.
    fetchPlayers(roomId).then(setPlayers).catch(() => {});
    return () => {
      unsubPlayers();
      unsubRoom();
    };
  }, [roomId, navigation]);

  // Leave the party whenever this screen is popped (back button, swipe, or the
  // kicked auto-goBack). Fire-and-forget; the RPC is idempotent, so the already
  // kicked/gone case is harmless. Host leaving closes the party for everyone.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      leaveRoom(roomId).catch(() => {});
    });
    return unsub;
  }, [navigation, roomId]);

  // When the host starts a game, every device follows the room into it. When it
  // returns to the lobby, reset so the next round can navigate again.
  useEffect(() => {
    if (!room) {
      return;
    }
    if (room.status === 'in_progress' && room.gameType === 'hattrick') {
      if (!inGameRef.current) {
        inGameRef.current = true;
        navigation.navigate('Hattrick', {roomId});
      }
    } else if (room.status === 'in_progress' && room.gameType === 'red-card') {
      if (!inGameRef.current) {
        inGameRef.current = true;
        navigation.navigate('RedCard', {roomId});
      }
    } else if (room.status === 'lobby') {
      inGameRef.current = false;
      setStarting(false);
    }
  }, [room, navigation, roomId]);

  const isHost = !!room && !!myUserId && room.hostId === myUserId;
  const me = players.find(p => p.userId === myUserId);

  // Kicked-out detection: once we've been seen in the roster, disappearing from
  // it means the host removed us — leave the lobby.
  useEffect(() => {
    if (!myUserId || players.length === 0) {
      return;
    }
    if (players.some(p => p.userId === myUserId)) {
      wasPresentRef.current = true;
      return;
    }
    if (wasPresentRef.current && !kickedRef.current) {
      kickedRef.current = true;
      navigation.goBack();
      Alert.alert(t('common.miflo'), t('lobby.kicked'));
    }
  }, [players, myUserId, navigation, t]);

  // A guest who backed out of a still-running game re-enters it manually. The
  // auto-nav effect above won't do it (inGameRef stays true until the room
  // returns to the lobby), but a direct navigate isn't blocked by that guard.
  function rejoinGame() {
    if (room?.gameType === 'hattrick') {
      navigation.navigate('Hattrick', {roomId});
    } else if (room?.gameType === 'red-card') {
      navigation.navigate('RedCard', {roomId});
    }
  }

  async function shareCode() {
    if (!room?.code) {
      return;
    }
    try {
      await Share.share({message: t('lobby.shareMessage', {code: room.code})});
    } catch {
      // User dismissed the share sheet; nothing to do.
    }
  }

  function onPressPlayer(p: RoomPlayer) {
    if (p.userId === myUserId) {
      setRenameOpen(true);
    } else if (isHost) {
      Alert.alert(t('lobby.removeTitle'), t('lobby.removeConfirm', {name: p.name}), [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => {
            kickPlayer(roomId, p.userId).catch(() =>
              Alert.alert(t('common.miflo'), t('lobby.errorRemove', {name: p.name})),
            );
          },
        },
      ]);
    }
  }

  async function submitRename(name: string) {
    setRenameOpen(false);
    try {
      await renamePlayer(roomId, name);
    } catch {
      Alert.alert(t('common.miflo'), t('lobby.errorRename'));
    }
  }

  // Whether this party is locked to a pre-chosen game (came from the Games tab)
  // or free to pick (came from Home, where the room is created as `'unset'`).
  const locked = room ? isBuiltGame(room.gameType) : false;

  // Human title for a game type, via the presentation catalog.
  function gameTitle(gameType: string): string {
    const entry = GAMES.find(g => g.gameType === gameType);
    return entry ? t(`games.${entry.i18nKey}.title`) : gameType;
  }

  // Host starts a specific game: build its initial state from the roster, then
  // hand every device into the game via the room. Only hattrick has an engine
  // today; the picker/lock never offers an unbuilt game, so that's the one case.
  async function startGame(gameType: string) {
    if (players.length < 2 || starting) {
      return;
    }
    setStarting(true);
    try {
      switch (gameType) {
        case 'hattrick': {
          const grid = generateGrid(Math.random, {avoid: recentGridsRef.current});
          const roster = players.map(p => ({userId: p.userId, name: p.name}));
          const state = createIndividualState(grid, roster, {
            avoidStarter: lastStarterRef.current ?? undefined,
          });
          // Remember for next round (keep the last 5 grids).
          lastStarterRef.current = state.turnUserId;
          recentGridsRef.current = [
            gridSignature(grid),
            ...recentGridsRef.current,
          ].slice(0, 5);
          await startBoardGame(roomId, 'hattrick', state);
          break;
        }
        case 'red-card': {
          // Needs more players than Tic-Tac-Toe (1 imposter + ≥2 detectives to
          // make voting meaningful). Roles are assigned server-side; the host
          // only ships the candidate footballer pool.
          if (players.length < IMPOSTER_MIN) {
            setStarting(false);
            Alert.alert(
              t('common.miflo'),
              t('lobby.needPlayers', {count: IMPOSTER_MIN}),
            );
            return;
          }
          await startRedCardGame(roomId, buildFootballerPool());
          break;
        }
        default:
          throw new Error(`Unsupported game: ${gameType}`);
      }
    } catch (err) {
      setStarting(false);
      // TEMP DEBUG: surface the real Supabase/PostgREST error while diagnosing
      // the imposter start failure. Revert to the friendly message before commit.
      const e = err as {message?: string; code?: string; details?: string; hint?: string};
      console.warn('startGame failed', e);
      Alert.alert(
        'Start error (debug)',
        [e?.code && `code: ${e.code}`, e?.message, e?.details, e?.hint]
          .filter(Boolean)
          .join('\n\n') || String(err),
      );
    }
  }

  // The game-picker page hands its choice back via a route param. Clear it first
  // so a re-focus can't re-fire, then start the round on this (still-mounted) host.
  const pickedGame = route.params?.pickedGame;
  useEffect(() => {
    if (pickedGame) {
      navigation.setParams({pickedGame: undefined});
      startGame(pickedGame);
    }
    // startGame reads the live roster/refs via closure; keyed on the returned pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedGame]);

  return (
    // Drop top/bottom safe-area edges — the scroll content owns the top inset
    // (the wordmark scrolls away) and the bottom bar owns the bottom inset.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.body,
          {paddingTop: insets.top + spacing.sm, paddingBottom: botH + spacing.xl},
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Wordmark header — in the scroll flow, so it scrolls off the top. */}
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            {t('lobby.title')}
          </Text>
        </View>

        {/* Party code — tapping it still opens the share sheet, quietly. */}
        <Pressable
          style={styles.codeWrap}
          onPress={shareCode}
          accessibilityRole="button"
          accessibilityLabel={t('lobby.shareCode')}>
          <GlassCard radius="pill" style={styles.codeCard}>
            <Text variant="caption" color="muted" align="center" style={styles.codeLabel}>
              {t('lobby.code')}
            </Text>
            <Text variant="hero" align="center" style={styles.code}>
              {room?.code ?? '· · · ·'}
            </Text>
          </GlassCard>
        </Pressable>

        <Text variant="secondary" color="secondary" align="center">
          {players.length <= 1
            ? t('lobby.waitingFriends')
            : t('lobby.inParty', {count: players.length})}
        </Text>

        {/* Live name list (Kahoot-style). Tap your own name to rename; the host
            taps another name to remove them. */}
        <View style={styles.roster}>
          {players.map(p => {
            const isMe = p.userId === myUserId;
            const actionable = isMe || isHost;
            return (
              <GlassTag
                key={p.id}
                size="sm"
                borderWidth={2}
                accent={isMe}
                disabled={!actionable}
                onPress={() => onPressPlayer(p)}
                accessibilityRole={actionable ? 'button' : undefined}
                accessibilityLabel={
                  (isMe
                    ? t('lobby.changeName')
                    : isHost
                    ? t('lobby.removeName', {name: p.name})
                    : p.name) + (p.isHost ? `, ${t('lobby.host')}` : '')
                }>
                <Text variant="section" style={styles.nameText}>
                  {p.name}
                </Text>
                {p.isHost ? (
                  <View style={styles.hostBadge}>
                    <Text variant="caption" color="onInk" style={styles.hostBadgeText}>
                      {t('lobby.hostBadge')}
                    </Text>
                  </View>
                ) : null}
              </GlassTag>
            );
          })}
        </View>
      </ScrollView>

      {/* Pinned floating back button (top-left) — stays reachable while the
          wordmark scrolls away, mirroring Home's floating corner button. */}
      <FloatingBar edge="top" style={styles.backBar}>
        <View style={styles.backRow}>
          <CircleButton
            size={36}
            accessibilityLabel={t('lobby.leave')}
            onPress={() => navigation.goBack()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        </View>
      </FloatingBar>

      {/* Floating footer — the host's game button (or guest hint) floats over
          the roster with no box behind it. Host picks the game; guests wait. */}
      <FloatingBar edge="bottom" onHeight={setBotH} style={styles.footer}>
        {isHost ? (
          <Button
            label={
              starting
                ? t('lobby.starting')
                : locked && room
                ? t('lobby.startGame', {game: gameTitle(room.gameType)})
                : t('lobby.pickGame')
            }
            variant="primary"
            disabled={players.length < 2 || starting}
            onPress={() =>
              locked && room
                ? startGame(room.gameType)
                : navigation.navigate('GamePicker', {roomId})
            }
          />
        ) : room?.status === 'in_progress' ? (
          <Button
            label={t('lobby.rejoin')}
            variant="primary"
            onPress={rejoinGame}
          />
        ) : (
          <Text variant="secondary" color="secondary" align="center">
            {locked ? t('lobby.waitingHostStart') : t('lobby.waitingHostPick')}
          </Text>
        )}
      </FloatingBar>

      {/* Seamless frosted fade behind the status bar — the wordmark dissolves
          under it as it scrolls up. */}
      <TopStatusFade />

      <NameSheet
        visible={renameOpen}
        title={t('lobby.renameTitle')}
        initialValue={me?.name ?? ''}
        placeholder={t('lobby.namePlaceholder')}
        confirmLabel={t('common.save')}
        onConfirm={submitRename}
        onCancel={() => setRenameOpen(false)}
      />
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
  body: {
    gap: spacing.xl,
  },
  // Party code on a frosted "liquid glass" pill that lifts off the rainbow canvas.
  codeWrap: {alignSelf: 'center'},
  codeCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    gap: spacing.xs,
  },
  codeLabel: {letterSpacing: 1},
  code: {letterSpacing: 6},
  roster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  // Smaller than the 20pt "section" default so more players fit per row.
  nameText: {color: colors.ink, fontSize: 15, lineHeight: 19},
  // Small accent pill marking the host — straddles the tag's top border,
  // centered then nudged a bit left.
  hostBadge: {
    position: 'absolute',
    top: -10,
    // Left-anchored to the name's text inset so it lines up with the name below.
    left: spacing.lg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  hostBadgeText: {fontSize: 10, lineHeight: 13, letterSpacing: 0.5},
  // Only top padding for vertical rhythm — FloatingBar owns the bottom safe-area
  // inset. Horizontal padding matches the scrolled content.
  footer: {
    paddingTop: spacing.md,
    paddingHorizontal: screenPadding,
  },
});
