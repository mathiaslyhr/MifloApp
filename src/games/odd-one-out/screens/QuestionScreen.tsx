import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Button, Screen, ScreenHeader, StickyFooter, Text} from '../../../core/ui';
import {minTapTarget, spacing} from '../../../theme';
import type {RootStackParamList} from '../../../core/navigation/types';
import {ensureSession} from '../../../core/supabase/client';
import {
  finishGame,
  setPhase,
  subscribePlayers,
  subscribeRoom,
  updateScore,
} from '../../../core/rooms/roomService';
import {AnswerOption, type AnswerState} from '../../quiz/components/AnswerOption';
import {StandingRow} from '../../quiz/components/StandingRow';
import {TimerRing} from '../../quiz/components/TimerRing';
import {fractionRemaining, nextTransition, phaseDurationMs} from '../../quiz/gameClock';
import {
  QUESTION_DURATION_MS,
  REVEAL_DURATION_MS,
  STANDINGS_DURATION_MS,
  rankContestants,
} from '../../quiz/scoring';
import {contestantsFromPlayers, useOddStore} from '../store';

type Props = NativeStackScreenProps<RootStackParamList, 'OddOneOutQuestion'>;

/**
 * The in-round screen for Odd One Out, driven by `phase`: question → reveal →
 * standings. Same shared clock as the quiz (the host writes each transition +
 * deadline; every device renders from the room), only the content differs: four
 * player cards, and the reveal explains the attribute the other three shared.
 */
export function QuestionScreen({navigation, route}: Props) {
  const {roomId, isHost, code, count} = route.params;
  const rounds = useOddStore(s => s.rounds);
  const index = useOddStore(s => s.index);
  const total = useOddStore(s => s.count);
  const phase = useOddStore(s => s.phase);
  const selected = useOddStore(s => s.selected);
  const answered = useOddStore(s => s.answered);
  const lastPoints = useOddStore(s => s.lastPoints);
  const you = useOddStore(s => s.you);
  const contestants = useOddStore(s => s.contestants);
  const prevRankById = useOddStore(s => s.prevRankById);
  const lockAnswer = useOddStore(s => s.lockAnswer);
  const reveal = useOddStore(s => s.reveal);
  const showStandings = useOddStore(s => s.showStandings);
  const next = useOddStore(s => s.next);
  const start = useOddStore(s => s.start);
  const syncContestants = useOddStore(s => s.syncContestants);

  const [deadlineTs, setDeadlineTs] = useState<number | null>(null);
  const deadlineRef = useRef<number | null>(null);

  // Safety net if reached without a deck (dev fast-refresh). Solo only.
  useEffect(() => {
    if (rounds.length === 0 && !roomId) {
      start(count ?? 10, 'You');
    }
  }, [rounds.length, roomId, start, count]);

  // Networked game: pull other players' live scores in as they come.
  const myUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!roomId) {
      return;
    }
    ensureSession().then(uid => {
      myUserId.current = uid;
    });
    return subscribePlayers(roomId, players => {
      syncContestants(contestantsFromPlayers(players, myUserId.current));
    });
  }, [roomId, syncContestants]);

  // Networked game: follow the host's phase clock off the room row.
  useEffect(() => {
    if (!roomId) {
      return;
    }
    return subscribeRoom(roomId, room => {
      if (room.status === 'finished') {
        navigation.replace('OddOneOutPodium', {roomId, code, isHost});
        return;
      }
      if (!room.phase) {
        return;
      }
      const dl = room.phaseDeadline ? Date.parse(room.phaseDeadline) : null;
      setDeadlineTs(dl);
      deadlineRef.current = dl;

      const st = useOddStore.getState();
      if (room.currentIndex !== st.index) {
        next();
      } else if (room.phase === 'reveal') {
        reveal();
      } else if (room.phase === 'standings') {
        showStandings();
      }
    });
  }, [roomId, isHost, code, navigation, next, reveal, showStandings]);

  // Host only: schedule the next transition at the current deadline and write it.
  useEffect(() => {
    if (!roomId || !isHost || deadlineTs == null) {
      return;
    }
    const delay = Math.max(0, deadlineTs - Date.now());
    const id = setTimeout(async () => {
      const t = nextTransition(phase, index, total);
      try {
        if ('finished' in t && t.finished) {
          const results = rankContestants(useOddStore.getState().contestants).map(s => ({
            user_id: s.contestant.id,
            name: s.contestant.name,
            score: s.contestant.score,
            rank: s.rank,
            is_winner: s.rank === 1,
          }));
          await finishGame(roomId, results, 'odd-one-out');
        } else {
          await setPhase(roomId, t.phase, t.index, Date.now() + phaseDurationMs(t.phase));
        }
      } catch {
        // A failed write leaves the deadline passed; the next render retries.
      }
    }, delay);
    return () => clearTimeout(id);
  }, [roomId, isHost, phase, index, total, deadlineTs]);

  // Push our cumulative score after each reveal so other devices rank us right.
  useEffect(() => {
    if (roomId && phase === 'reveal') {
      updateScore(roomId, you.score).catch(() => {});
    }
  }, [roomId, phase, you.score]);

  const startRef = useRef(Date.now());
  useEffect(() => {
    startRef.current = Date.now();
  }, [index]);

  const round = rounds[index];
  const isLast = index >= total - 1;

  const submit = useCallback(
    (optionIndex: number | null) => {
      const fraction =
        roomId && deadlineRef.current != null
          ? fractionRemaining(deadlineRef.current, Date.now())
          : Math.max(0, 1 - (Date.now() - startRef.current) / QUESTION_DURATION_MS);
      lockAnswer(optionIndex, fraction);
      if (!roomId) {
        reveal();
      } else if (isHost && contestants.length <= 1) {
        setDeadlineTs(Date.now());
      }
    },
    [roomId, isHost, contestants.length, lockAnswer, reveal],
  );

  const handleTimeout = useCallback(() => {
    if (roomId) {
      lockAnswer(null, 0);
    } else {
      submit(null);
    }
  }, [roomId, lockAnswer, submit]);

  const advance = useCallback(() => {
    if (isLast) {
      navigation.replace('OddOneOutPodium', {roomId, code});
    } else {
      next();
    }
  }, [isLast, navigation, roomId, code, next]);

  // Solo only: auto-advance the timed phases (networked uses the host clock).
  useEffect(() => {
    if (roomId) {
      return;
    }
    if (phase === 'reveal') {
      const id = setTimeout(showStandings, REVEAL_DURATION_MS);
      return () => clearTimeout(id);
    }
    if (phase === 'standings') {
      const id = setTimeout(advance, STANDINGS_DURATION_MS);
      return () => clearTimeout(id);
    }
  }, [roomId, phase, index, showStandings, advance]);

  const standings = useMemo(
    () => rankContestants(contestants, prevRankById),
    [contestants, prevRankById],
  );

  if (!round) {
    return <Screen />;
  }

  const isCorrect = selected !== null && selected === round.outlierIndex;
  const heading = isCorrect ? 'Correct!' : selected === null ? "Time's up" : 'Wrong';

  function stateFor(i: number): AnswerState {
    if (phase === 'question') {
      return answered && i === selected ? 'selected' : 'idle';
    }
    // Reveal: the outlier is the right pick — mark it correct, a wrong tap wrong.
    if (i === round.outlierIndex) {
      return 'correct';
    }
    if (i === selected) {
      return 'wrong';
    }
    return 'muted';
  }

  return (
    <Screen>
      <ScreenHeader
        title={
          phase === 'standings' ? 'Standings' : `Round ${index + 1} of ${total}`
        }
        subtitle={
          phase === 'standings'
            ? `Round ${index + 1} of ${total}`
            : 'Tap the odd one out'
        }
      />

      {phase === 'standings' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.standings}
          showsVerticalScrollIndicator={false}>
          {standings.map((standing, i) => (
            <StandingRow
              key={standing.contestant.id}
              standing={standing}
              divider={i < standings.length - 1}
            />
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.status}>
            {phase === 'reveal' ? (
              <View style={styles.result}>
                <Text variant="title" color={isCorrect ? 'success' : 'error'} center>
                  {heading}
                </Text>
                <Text
                  variant="body"
                  color={lastPoints > 0 ? 'success' : 'textSecondary'}
                  center>
                  {lastPoints > 0 ? `+${lastPoints} points` : 'No points'}
                </Text>
              </View>
            ) : (
              <TimerRing
                durationMs={QUESTION_DURATION_MS}
                running={phase === 'question'}
                onTimeout={handleTimeout}
                deadlineTs={roomId ? deadlineTs ?? undefined : undefined}
                size={88}
              />
            )}
          </View>

          <View style={styles.options}>
            {round.cards.map((card, i) => (
              <AnswerOption
                key={card.footballerId}
                label={card.name}
                state={stateFor(i)}
                onPress={() => submit(i)}
                disabled={phase !== 'question' || (!!roomId && answered)}
              />
            ))}
          </View>

          {phase === 'question' && roomId && answered && contestants.length > 1 && (
            <Text variant="secondary" color="textSecondary" center style={styles.about}>
              Answer locked — waiting for the others…
            </Text>
          )}

          {phase === 'reveal' && (
            <Text variant="secondary" color="textSecondary" center style={styles.about}>
              {round.explanation}
            </Text>
          )}
        </ScrollView>
      )}

      <StickyFooter>
        {!roomId && phase === 'reveal' && (
          <Button label="Continue" onPress={showStandings} />
        )}
        {!roomId && phase === 'standings' && (
          <Button label={isLast ? 'See podium' : 'Next round'} onPress={advance} />
        )}
        {(roomId || phase === 'question') && <View style={styles.footerSpacer} />}
      </StickyFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  standings: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  status: {
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  result: {
    gap: spacing.xs,
  },
  options: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  about: {
    marginTop: spacing.lg,
  },
  footerSpacer: {
    height: minTapTarget + 8,
  },
});
