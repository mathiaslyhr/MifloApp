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
import {
  Button,
  CircleButton,
  FloatingBar,
  GamePickerSheet,
  NameSheet,
  PressableScale,
  Screen,
  Text,
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
  startImposterGame,
  subscribePlayers,
  subscribeRoom,
} from '../core/rooms/roomService';
import {ensureSession} from '../core/supabase/client';
import {generateGrid, gridSignature} from '../games/tic-tac-toe/grid';
import {createIndividualState} from '../games/tic-tac-toe/engine';
import {buildFootballerPool} from '../games/footballer-imposter/engine';
import {MIN_PLAYERS as IMPOSTER_MIN} from '../games/footballer-imposter/types';
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  // Measured heights of the floating top/bottom chrome, so scroll content can
  // reserve matching clearance and glide behind them (no clipping "box").
  const [topH, setTopH] = useState(0);
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
    if (room.status === 'in_progress' && room.gameType === 'tic-tac-toe') {
      if (!inGameRef.current) {
        inGameRef.current = true;
        navigation.navigate('TicTacToe', {roomId});
      }
    } else if (room.status === 'in_progress' && room.gameType === 'footballer-imposter') {
      if (!inGameRef.current) {
        inGameRef.current = true;
        navigation.navigate('FootballerImposter', {roomId});
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
  // hand every device into the game via the room. Only tic-tac-toe has an engine
  // today; the picker/lock never offers an unbuilt game, so that's the one case.
  async function startGame(gameType: string) {
    if (players.length < 2 || starting) {
      return;
    }
    setPickerOpen(false);
    setStarting(true);
    try {
      switch (gameType) {
        case 'tic-tac-toe': {
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
          await startBoardGame(roomId, 'tic-tac-toe', state);
          break;
        }
        case 'footballer-imposter': {
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
          await startImposterGame(roomId, buildFootballerPool());
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

  return (
    // Drop top/bottom safe-area edges — the floating bars own those insets so
    // the roster scrolls the full height, behind the chrome, with no clip line.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.body,
          {paddingTop: topH + spacing.xl, paddingBottom: botH + spacing.xl},
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Party code — tapping it still opens the share sheet, quietly. */}
        <Pressable
          style={styles.codeCard}
          onPress={shareCode}
          accessibilityRole="button"
          accessibilityLabel={t('lobby.shareCode')}>
          <Text variant="caption" color="muted" align="center" style={styles.codeLabel}>
            {t('lobby.code')}
          </Text>
          <Text variant="hero" align="center" style={styles.code}>
            {room?.code ?? '· · · ·'}
          </Text>
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
              <PressableScale
                key={p.id}
                style={[styles.nameTag, isMe && styles.nameTagMe]}
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
              </PressableScale>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating header — back button + wordmark, no background; the roster
          scrolls behind it. */}
      <FloatingBar edge="top" onHeight={setTopH} style={styles.topBar}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <CircleButton
              size={36}
              accessibilityLabel={t('lobby.leave')}
              onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
            </CircleButton>
          </View>
          <Text variant="wordmark" align="center">
            {t('lobby.title')}
          </Text>
        </View>
      </FloatingBar>

      {/* Floating footer — the host's game button (or guest hint) floats over
          the roster. Host picks the game; guests wait. */}
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
              locked && room ? startGame(room.gameType) : setPickerOpen(true)
            }
          />
        ) : (
          <Text variant="secondary" color="secondary" align="center">
            {locked ? t('lobby.waitingHostStart') : t('lobby.waitingHostPick')}
          </Text>
        )}
      </FloatingBar>

      <NameSheet
        visible={renameOpen}
        title={t('lobby.renameTitle')}
        initialValue={me?.name ?? ''}
        placeholder={t('lobby.namePlaceholder')}
        confirmLabel={t('common.save')}
        onConfirm={submitRename}
        onCancel={() => setRenameOpen(false)}
      />

      <GamePickerSheet
        visible={pickerOpen}
        title={t('lobby.pickTitle')}
        onSelect={startGame}
        onCancel={() => setPickerOpen(false)}
      />
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
  headerLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  scroll: {flex: 1},
  body: {
    gap: spacing.xl,
  },
  // Party code on a frosted "liquid glass" pill that lifts off the rainbow canvas.
  codeCard: {
    alignSelf: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    gap: spacing.xs,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassRim,
    borderRadius: radii.pill,
    shadowColor: '#140F32',
    shadowOpacity: 0.18,
    shadowOffset: {width: 0, height: 16},
    shadowRadius: 24,
    elevation: 8,
  },
  codeLabel: {letterSpacing: 1},
  code: {letterSpacing: 6},
  roster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  nameTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
    // 2px border always reserved so the "me" accent doesn't resize the tag.
    borderWidth: 2,
    borderColor: colors.glassRim,
  },
  // Your own tag: brand-purple outline (paired with the "you" marker).
  nameTagMe: {borderColor: colors.primary},
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
  // FloatingBar spans edge-to-edge; pad it horizontally so the chrome (back
  // button, game button) lines up with the 16px-inset scrolled content.
  topBar: {
    paddingHorizontal: screenPadding,
  },
  // Only top padding for vertical rhythm — FloatingBar owns the bottom safe-area
  // inset. Horizontal padding matches the scrolled content + the top bar.
  footer: {
    paddingTop: spacing.md,
    paddingHorizontal: screenPadding,
  },
});
