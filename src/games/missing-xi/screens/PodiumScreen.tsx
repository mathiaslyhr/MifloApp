import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Avatar,
  Button,
  Icon,
  Screen,
  ScreenHeader,
  StickyFooter,
  Text,
} from '../../../core/ui';
import {colors, radii, spacing} from '../../../theme';
import type {RootStackParamList} from '../../../core/navigation/types';
import {ensureSession} from '../../../core/supabase/client';
import {
  fetchPlayers,
  fetchRoom,
  restartGame,
  setPhase,
  subscribeRoom,
} from '../../../core/rooms/roomService';
import {StandingRow} from '../../quiz/components/StandingRow';
import {formatPoints} from '../../quiz/mockData';
import {QUESTION_DURATION_MS, rankContestants, type Standing} from '../../quiz/scoring';
import {buildQuestions} from '../questions';
import {DEFAULT_QUESTION_COUNT, type MissingQuestion} from '../mockData';
import {contestantsFromPlayers, useMissingStore} from '../store';

type Props = NativeStackScreenProps<RootStackParamList, 'MissingXiPodium'>;

const BAR_HEIGHT: Record<number, number> = {1: 96, 2: 68, 3: 52};

/** Final results: top-3 podium, the rest as a list, and play-again / home. */
export function PodiumScreen({navigation, route}: Props) {
  const {roomId, code, isHost} = route.params;
  const contestants = useMissingStore(s => s.contestants);
  const total = useMissingStore(s => s.count);
  const playAgain = useMissingStore(s => s.playAgain);
  const hydrate = useMissingStore(s => s.hydrate);

  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const myUserId = useRef<string | null>(null);
  const navigatedRef = useRef(false);

  const standings = useMemo(() => rankContestants(contestants), [contestants]);

  const top3 = standings.slice(0, 3);
  const rest = standings.slice(3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const youWon = standings[0]?.contestant.isYou;

  useEffect(() => {
    ensureSession().then(uid => {
      myUserId.current = uid;
    });
  }, []);

  // Guests: when the host restarts, follow the room back into the new game.
  useEffect(() => {
    if (isHost || !roomId) {
      return;
    }
    return subscribeRoom(roomId, async room => {
      if (room.status !== 'in_progress' || !room.questions || navigatedRef.current) {
        return;
      }
      navigatedRef.current = true;
      const roster = await fetchPlayers(roomId).catch(() => []);
      hydrate(
        room.questions as MissingQuestion[],
        contestantsFromPlayers(roster, myUserId.current),
      );
      navigation.replace('MissingXiQuestion', {roomId, code, isHost: false});
    });
  }, [isHost, roomId, code, navigation, hydrate]);

  async function handlePlayAgain() {
    if (!roomId) {
      playAgain();
      navigation.replace('MissingXiQuestion', {roomId, code, count: total});
      return;
    }

    setRestarting(true);
    setError(null);
    try {
      const room = await fetchRoom(roomId);
      const count = room?.questionCount ?? total ?? DEFAULT_QUESTION_COUNT;
      const deck = buildQuestions(count);
      await restartGame(roomId, deck);
      await setPhase(roomId, 'question', 0, Date.now() + QUESTION_DURATION_MS);
      navigatedRef.current = true;
      const roster = await fetchPlayers(roomId).catch(() => []);
      hydrate(deck, contestantsFromPlayers(roster, myUserId.current));
      navigation.replace('MissingXiQuestion', {roomId, code, isHost: true});
    } catch {
      setError('Couldn’t start a new game. Try again.');
      setRestarting(false);
    }
  }

  const canRestart = isHost || !roomId;

  return (
    <Screen>
      <ScreenHeader title={youWon ? 'You won!' : 'Final results'} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.podium}>
          {podiumOrder.map(standing => (
            <PodiumSpot key={standing.contestant.id} standing={standing} />
          ))}
        </View>

        {rest.length > 0 && (
          <View style={styles.rest}>
            {rest.map((standing, i) => (
              <StandingRow
                key={standing.contestant.id}
                standing={standing}
                divider={i < rest.length - 1}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <StickyFooter style={styles.footer}>
        {error && (
          <Text variant="secondary" color="error" center>
            {error}
          </Text>
        )}
        {canRestart ? (
          <Button
            label={restarting ? 'Starting…' : 'Play again'}
            disabled={restarting}
            onPress={handlePlayAgain}
          />
        ) : (
          <Text variant="secondary" color="textSecondary" center>
            Waiting for the host to start a new game…
          </Text>
        )}
        <Button
          label="Back to home"
          variant="secondary"
          onPress={() => navigation.popToTop()}
        />
      </StickyFooter>
    </Screen>
  );
}

function PodiumSpot({standing}: {standing: Standing}) {
  const {rank, contestant} = standing;
  const first = rank === 1;
  return (
    <View style={styles.spot}>
      {first && <Icon name="trophy" size={22} color="primary" />}
      <Avatar
        name={contestant.name}
        variant={first ? 'host' : 'neutral'}
        size={first ? 64 : 52}
      />
      <Text variant="body" numberOfLines={1} style={styles.spotName}>
        {contestant.name}
      </Text>
      <Text variant="secondary" color="textSecondary">
        {formatPoints(contestant.score)}
      </Text>
      <View style={[styles.bar, {height: BAR_HEIGHT[rank] ?? 40}]}>
        <Text variant="section">{rank}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.md,
  },
  spot: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  spotName: {
    marginTop: spacing.xs,
    maxWidth: '100%',
  },
  bar: {
    marginTop: spacing.sm,
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rest: {
    marginTop: spacing.xl,
  },
  footer: {
    gap: spacing.md,
  },
});
