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
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Button,
  CircleButton,
  NameSheet,
  PressableScale,
  Screen,
  Text,
} from '../core/ui';
import {colors, radii, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {
  fetchPlayers,
  kickPlayer,
  leaveRoom,
  renamePlayer,
  startBoardGame,
  subscribePlayers,
  subscribeRoom,
} from '../core/rooms/roomService';
import {ensureSession} from '../core/supabase/client';
import {generateGrid} from '../games/tic-tac-toe/grid';
import {createIndividualState} from '../games/tic-tac-toe/engine';
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
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  // Track membership so we can detect being kicked (present → gone).
  const wasPresentRef = useRef(false);
  const kickedRef = useRef(false);
  // Guards the one-shot navigation into the game when it starts.
  const inGameRef = useRef(false);

  useEffect(() => {
    ensureSession()
      .then(setMyUserId)
      .catch(() => {});
    const unsubPlayers = subscribePlayers(roomId, setPlayers);
    const unsubRoom = subscribeRoom(roomId, setRoom);
    // Prime the roster once in case the realtime channel is slow to attach.
    fetchPlayers(roomId).then(setPlayers).catch(() => {});
    return () => {
      unsubPlayers();
      unsubRoom();
    };
  }, [roomId]);

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
      Alert.alert('Miflo', 'You were removed from the party.');
    }
  }, [players, myUserId, navigation]);

  async function shareCode() {
    if (!room?.code) {
      return;
    }
    try {
      await Share.share({message: `Join my Miflo party — code ${room.code}`});
    } catch {
      // User dismissed the share sheet; nothing to do.
    }
  }

  function onPressPlayer(p: RoomPlayer) {
    if (p.userId === myUserId) {
      setRenameOpen(true);
    } else if (isHost) {
      Alert.alert('Remove player', `Remove ${p.name} from the party?`, [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            kickPlayer(roomId, p.userId).catch(() =>
              Alert.alert('Miflo', `Couldn't remove ${p.name}.`),
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
      Alert.alert('Miflo', "Couldn't change your name.");
    }
  }

  // Host starts Tic-Tac-Toe (Individual): build a solvable grid + initial state
  // from the roster, then hand every device into the game via the room.
  async function handlePickGame() {
    if (players.length < 2 || starting) {
      return;
    }
    setStarting(true);
    try {
      const grid = generateGrid();
      const roster = players.map(p => ({userId: p.userId, name: p.name}));
      await startBoardGame(roomId, 'tic-tac-toe', createIndividualState(grid, roster));
    } catch {
      setStarting(false);
      Alert.alert('Miflo', "Couldn't start the game. Please try again.");
    }
  }

  return (
    <Screen canvas>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <CircleButton
            size={36}
            accessibilityLabel="Leave party"
            onPress={() => navigation.goBack()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        </View>
        <Text variant="wordmark" align="center">
          Party
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        {/* Party code — tapping it still opens the share sheet, quietly. */}
        <Pressable
          style={styles.codeCard}
          onPress={shareCode}
          accessibilityRole="button"
          accessibilityLabel="Share party code">
          <Text variant="caption" color="muted" align="center" style={styles.codeLabel}>
            PARTY CODE
          </Text>
          <Text variant="hero" align="center" style={styles.code}>
            {room?.code ?? '· · · ·'}
          </Text>
        </Pressable>

        <Text variant="secondary" color="secondary" align="center">
          {players.length <= 1
            ? 'Waiting for friends to join…'
            : `${players.length} in the party`}
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
                    ? 'Change your name'
                    : isHost
                    ? `Remove ${p.name}`
                    : p.name) + (p.isHost ? ', host' : '')
                }>
                <Text variant="section" style={styles.nameText}>
                  {p.name}
                </Text>
                {p.isHost ? (
                  <View style={styles.hostBadge}>
                    <Text variant="caption" color="onInk" style={styles.hostBadgeText}>
                      HOST
                    </Text>
                  </View>
                ) : null}
              </PressableScale>
            );
          })}
        </View>
      </ScrollView>

      {/* Host picks the game; guests wait. Selection is stubbed until games ship. */}
      <View style={styles.footer}>
        {isHost ? (
          <Button
            label={starting ? 'Starting…' : 'Pick a game'}
            variant="primary"
            disabled={players.length < 2 || starting}
            onPress={handlePickGame}
          />
        ) : (
          <Text variant="secondary" color="secondary" align="center">
            Waiting for the host to pick a game…
          </Text>
        )}
      </View>

      <NameSheet
        visible={renameOpen}
        title="Change your username"
        initialValue={me?.name ?? ''}
        placeholder="Your name"
        confirmLabel="Save"
        onConfirm={submitRename}
        onCancel={() => setRenameOpen(false)}
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
  body: {
    paddingTop: spacing.xxl,
    gap: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  codeCard: {
    alignSelf: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.card,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassRim,
    gap: spacing.xs,
  },
  codeLabel: {letterSpacing: 1},
  code: {letterSpacing: 6},
  roster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
  nameTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
    // 2px border always reserved so the "me" accent doesn't resize the tag.
    borderWidth: 2,
    borderColor: colors.glassRim,
  },
  // Your own tag: brand-purple outline (paired with the "you" marker).
  nameTagMe: {borderColor: colors.primary},
  nameText: {color: colors.ink},
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
  footer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
});
