import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Button, Screen, ScreenHeader, StickyFooter, Text} from '../../../core/ui';
import {minTapTarget, spacing} from '../../../theme';
import type {RootStackParamList} from '../../../core/navigation/types';
import {getById} from '../../../data/football';
import {ensureSession} from '../../../core/supabase/client';
import {
  finishGame,
  setPhase,
  subscribePlayers,
  subscribeRoom,
  updateScore,
} from '../../../core/rooms/roomService';
import {AnswerOption, type AnswerState} from '../components/AnswerOption';
import {StandingRow} from '../components/StandingRow';
import {TimerRing} from '../components/TimerRing';
import {
  fractionRemaining,
  nextTransition,
  phaseDurationMs,
} from '../gameClock';
import {
  QUESTION_DURATION_MS,
  REVEAL_DURATION_MS,
  STANDINGS_DURATION_MS,
  rankContestants,
} from '../scoring';
import {contestantsFromPlayers, useQuizStore} from '../store';

type Props = NativeStackScreenProps<RootStackParamList, 'QuizQuestion'>;

/**
 * The whole in-round screen, driven by `phase`: question → reveal → standings,
 * all without navigation so nothing jumps mid-round.
 *
 * Solo runs the phases on local timers. A networked game (M4) follows the host's
 * shared clock instead: the host writes each transition + an absolute deadline to
 * the room, every device renders from `subscribeRoom`, and the countdown ticks to
 * that deadline — so all phones reveal and advance together.
 */
export function QuestionScreen({navigation, route}: Props) {
  const {roomId, isHost, code, topicIds, count} = route.params;
  const questions = useQuizStore(s => s.questions);
  const index = useQuizStore(s => s.index);
  const total = useQuizStore(s => s.count);
  const phase = useQuizStore(s => s.phase);
  const selected = useQuizStore(s => s.selected);
  const answered = useQuizStore(s => s.answered);
  const lastPoints = useQuizStore(s => s.lastPoints);
  const you = useQuizStore(s => s.you);
  const contestants = useQuizStore(s => s.contestants);
  const prevRankById = useQuizStore(s => s.prevRankById);
  const lockAnswer = useQuizStore(s => s.lockAnswer);
  const reveal = useQuizStore(s => s.reveal);
  const showStandings = useQuizStore(s => s.showStandings);
  const next = useQuizStore(s => s.next);
  const start = useQuizStore(s => s.start);
  const syncContestants = useQuizStore(s => s.syncContestants);

  // Absolute deadline for the current phase, from the host clock (networked).
  const [deadlineTs, setDeadlineTs] = useState<number | null>(null);
  const deadlineRef = useRef<number | null>(null);

  // Safety net if reached without a deck (e.g. dev fast-refresh). Only for solo;
  // a networked game is always hydrated from the Lobby before navigating here.
  useEffect(() => {
    if (questions.length === 0 && !roomId) {
      start(topicIds ?? [], count ?? 10, 'You');
    }
  }, [questions.length, roomId, start, topicIds, count]);

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

  // Networked game: follow the host's phase clock. The room row is the source of
  // truth — drive the local phase machine off it (these store actions are
  // idempotent / guarded, so re-applying the same state is safe).
  useEffect(() => {
    if (!roomId) {
      return;
    }
    return subscribeRoom(roomId, room => {
      if (room.status === 'finished') {
        navigation.replace('QuizPodium', {roomId, code});
        return;
      }
      if (!room.phase) {
        return;
      }
      const dl = room.phaseDeadline ? Date.parse(room.phaseDeadline) : null;
      setDeadlineTs(dl);
      deadlineRef.current = dl;

      const st = useQuizStore.getState();
      if (room.currentIndex !== st.index) {
        next(); // advanced to the next question
      } else if (room.phase === 'reveal') {
        reveal();
      } else if (room.phase === 'standings') {
        showStandings();
      }
    });
  }, [roomId, code, navigation, next, reveal, showStandings]);

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
          // Host persists the final standings (M5). contestant.id is the
          // player's user_id (set by contestantsFromPlayers).
          const results = rankContestants(
            useQuizStore.getState().contestants,
          ).map(s => ({
            user_id: s.contestant.id,
            name: s.contestant.name,
            score: s.contestant.score,
            rank: s.rank,
            is_winner: s.rank === 1,
          }));
          await finishGame(roomId, results);
        } else {
          await setPhase(
            roomId,
            t.phase,
            t.index,
            Date.now() + phaseDurationMs(t.phase),
          );
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

  const question = questions[index];
  const isLast = index >= total - 1;

  const submit = useCallback(
    (optionIndex: number | null) => {
      const fraction =
        roomId && deadlineRef.current != null
          ? fractionRemaining(deadlineRef.current, Date.now())
          : Math.max(0, 1 - (Date.now() - startRef.current) / QUESTION_DURATION_MS);
      lockAnswer(optionIndex, fraction);
      // Solo reveals immediately; networked waits for the host to flip the phase.
      if (!roomId) {
        reveal();
      }
    },
    [roomId, lockAnswer, reveal],
  );

  // Time's up: solo reveals; networked just freezes the choice (host reveals).
  const handleTimeout = useCallback(() => {
    if (roomId) {
      lockAnswer(null, 0);
    } else {
      submit(null);
    }
  }, [roomId, lockAnswer, submit]);

  const advance = useCallback(() => {
    if (isLast) {
      navigation.replace('QuizPodium', {roomId, code});
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

  if (!question) {
    return <Screen />;
  }

  const isCorrect = selected !== null && selected === question.correctIndex;
  const heading = isCorrect ? 'Correct!' : selected === null ? "Time's up" : 'Wrong';
  const footballer = question.footballerId
    ? getById(question.footballerId)
    : undefined;

  function stateFor(i: number): AnswerState {
    if (phase === 'question') {
      return 'idle';
    }
    if (i === question.correctIndex) {
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
          phase === 'standings'
            ? 'Standings'
            : `Question ${index + 1} of ${total}`
        }
        subtitle={
          phase === 'standings'
            ? `Question ${index + 1} of ${total}`
            : question.topic
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
              />
            )}
          </View>

          <Text variant="section" center style={styles.prompt}>
            {question.prompt}
          </Text>

          <View style={styles.options}>
            {question.options.map((option, i) => (
              <AnswerOption
                key={option}
                label={option}
                state={stateFor(i)}
                onPress={() => submit(i)}
                disabled={phase !== 'question' || (!!roomId && answered)}
              />
            ))}
          </View>

          {phase === 'question' && roomId && answered && (
            <Text
              variant="secondary"
              color="textSecondary"
              center
              style={styles.about}>
              Answer locked — waiting for the others…
            </Text>
          )}

          {phase === 'reveal' && footballer && (
            <Text
              variant="secondary"
              color="textSecondary"
              center
              style={styles.about}>
              This one was about {footballer.name}.
            </Text>
          )}
        </ScrollView>
      )}

      <StickyFooter>
        {/* Solo lets you skip the wait; networked phases advance on the host
            clock, so no manual controls (a spacer keeps the layout steady). */}
        {!roomId && phase === 'reveal' && (
          <Button label="Continue" onPress={showStandings} />
        )}
        {!roomId && phase === 'standings' && (
          <Button label={isLast ? 'See podium' : 'Next question'} onPress={advance} />
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
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  result: {
    gap: spacing.xs,
  },
  prompt: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  options: {
    gap: spacing.md,
  },
  about: {
    marginTop: spacing.lg,
  },
  footerSpacer: {
    height: minTapTarget + 8,
  },
});
