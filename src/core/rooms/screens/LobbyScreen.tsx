import React, {useEffect, useRef, useState} from 'react';
import {Pressable, ScrollView, Share, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Screen,
  ScreenHeader,
  Text,
  Button,
  Avatar,
  Badge,
  Icon,
  StickyFooter,
} from '../../ui';
import {colors, radii, spacing} from '../../../theme';
import type {RootStackParamList} from '../../navigation/types';
import {ensureSession} from '../../supabase/client';
import {
  fetchPlayers,
  setPhase,
  startGame,
  subscribePlayers,
  subscribeRoom,
} from '../roomService';
import type {RoomPlayer} from '../types';
import {getGameRoom} from '../gameRoom';

type Props = NativeStackScreenProps<RootStackParamList, 'Lobby'>;

/**
 * Shared pre-game room for every game: shows the game code to share, the live
 * roster (via Realtime), and the host's start button. Game-specific behaviour —
 * building the deck, hydrating the store, and which screen to start — comes from
 * the game's registered room config (looked up by `gameType`). The host builds
 * the shared deck and starts; guests are taken into the game automatically when
 * the room flips to 'in_progress'. Both paths hydrate before navigating so
 * everyone plays the same deck against the same contestants.
 */
export function LobbyScreen({navigation, route}: Props) {
  const {roomId, code, isHost, gameType, topicIds, count} = route.params;
  const config = getGameRoom(gameType);
  const lobbyConfig = {topicIds, count};
  const subtitle = config.lobbySubtitle?.(lobbyConfig) ?? '';

  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const myUserId = useRef<string | null>(null);
  const navigatedRef = useRef(false);

  // Live roster — fires on joins and (later) score changes.
  useEffect(() => {
    ensureSession().then(uid => {
      myUserId.current = uid;
    });
    const unsubscribe = subscribePlayers(roomId, setPlayers);
    return unsubscribe;
  }, [roomId]);

  // Guests: when the host starts, the room flips to in_progress with the deck.
  useEffect(() => {
    if (isHost) {
      return;
    }
    const unsubscribe = subscribeRoom(roomId, async room => {
      if (room.status !== 'in_progress' || !room.questions || navigatedRef.current) {
        return;
      }
      navigatedRef.current = true;
      // Use the freshest roster for contestants.
      const roster = await fetchPlayers(roomId).catch(() => players);
      config.hydrate(room.questions, roster, myUserId.current);
      navigation.replace(config.questionRoute, {roomId, code, isHost: false});
    });
    return unsubscribe;
  }, [isHost, roomId, code, navigation, config, players]);

  function shareCode() {
    Share.share({
      message: `Join my Miflo game! Game code: ${code}`,
    }).catch(() => {});
  }

  async function startGameAndGo() {
    setStarting(true);
    setError(null);
    try {
      const deck = config.buildDeck(lobbyConfig);
      await startGame(roomId, deck);
      // Kick off the first phase on the shared clock so guests get a deadline.
      await setPhase(roomId, 'question', 0, Date.now() + config.firstPhaseDurationMs);
      navigatedRef.current = true;
      const roster = await fetchPlayers(roomId).catch(() => players);
      config.hydrate(deck, roster, myUserId.current);
      navigation.replace(config.questionRoute, {roomId, code, isHost: true});
    } catch {
      setError('Couldn’t start the game. Try again.');
      setStarting(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Lobby"
        subtitle={subtitle}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.codeCard}>
          <Text variant="secondary" color="textSecondary" center>
            Game code
          </Text>
          <Text variant="title" center style={styles.code}>
            {code}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={shareCode}
            style={({pressed}) => [styles.share, pressed && styles.pressed]}>
            <Icon name="share" size={18} />
            <Text variant="body" style={styles.shareLabel}>
              Share code
            </Text>
          </Pressable>
        </View>

        <View style={styles.playersHeader}>
          <Text variant="secondary" color="textSecondary">
            Players
          </Text>
          <Text variant="secondary" color="textSecondary">
            {players.length}
          </Text>
        </View>

        <View>
          {players.map(player => (
            <View key={player.id} style={styles.playerRow}>
              <Avatar
                name={player.name}
                variant={player.isHost ? 'host' : 'neutral'}
              />
              <Text variant="body" style={styles.playerName}>
                {player.name}
              </Text>
              {player.isHost && <Badge label="host" tone="host" />}
            </View>
          ))}
          <View style={styles.waitingRow}>
            <Avatar variant="waiting" />
            <Text variant="body" color="textSecondary">
              waiting for more…
            </Text>
          </View>
        </View>
      </ScrollView>

      {isHost && (
        <StickyFooter>
          {error && (
            <Text variant="secondary" color="error" center style={styles.error}>
              {error}
            </Text>
          )}
          <Button
            label={starting ? 'Starting…' : 'Start game'}
            disabled={starting || players.length === 0}
            onPress={startGameAndGo}
          />
        </StickyFooter>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  codeCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  code: {
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: 14,
    // letter-spacing pads the right edge; nudge back to keep it centered
    marginRight: -14,
  },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  shareLabel: {
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.85,
  },
  playersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  playerName: {
    flex: 1,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  error: {
    marginBottom: spacing.sm,
  },
});
