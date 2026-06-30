import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View} from 'react-native';
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
import {StandingRow} from '../../quiz/components/StandingRow';
import {TimerRing} from '../../quiz/components/TimerRing';
import {fractionRemaining, nextTransition, phaseDurationMs} from '../../quiz/gameClock';
import {
  QUESTION_DURATION_MS,
  REVEAL_DURATION_MS,
  STANDINGS_DURATION_MS,
  rankContestants,
} from '../../quiz/scoring';
import {Pitch} from '../components/Pitch';
import {PlayerNameInput} from '../components/PlayerNameInput';
import {isCorrectGuess} from '../matching';
import {contestantsFromPlayers, useMissingStore} from '../store';

type Props = NativeStackScreenProps<RootStackParamList, 'MissingXiQuestion'>;

/**
 * The in-round screen for Missing XI: one famous lineup with a slot hidden, and
 * a name field with autocomplete. Same shared clock as the quiz; the only
 * difference is the answer is typed text, verified against the hidden player.
 */
export function QuestionScreen({navigation, route}: Props) {
  const {roomId, isHost, code, count} = route.params;
  const questions = useMissingStore(s => s.questions);
  const index = useMissingStore(s => s.index);
  const total = useMissingStore(s => s.count);
  const phase = useMissingStore(s => s.phase);
  const guess = useMissingStore(s => s.guess);
  const answered = useMissingStore(s => s.answered);
  const lastPoints = useMissingStore(s => s.lastPoints);
  const you = useMissingStore(s => s.you);
  const contestants = useMissingStore(s => s.contestants);
  const prevRankById = useMissingStore(s => s.prevRankById);
  const lockAnswer = useMissingStore(s => s.lockAnswer);
  const reveal = useMissingStore(s => s.reveal);
  const showStandings = useMissingStore(s => s.showStandings);
  const next = useMissingStore(s => s.next);
  const start = useMissingStore(s => s.start);
  const syncContestants = useMissingStore(s => s.syncContestants);

  const [text, setText] = useState('');
  const [deadlineTs, setDeadlineTs] = useState<number | null>(null);
  const deadlineRef = useRef<number | null>(null);

  // Clear the input on each new question.
  useEffect(() => {
    setText('');
  }, [index]);

  // Safety net if reached without a deck (dev fast-refresh). Solo only.
  useEffect(() => {
    if (questions.length === 0 && !roomId) {
      start(count ?? 10, 'You');
    }
  }, [questions.length, roomId, start, count]);

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
        navigation.replace('MissingXiPodium', {roomId, code, isHost});
        return;
      }
      if (!room.phase) {
        return;
      }
      const dl = room.phaseDeadline ? Date.parse(room.phaseDeadline) : null;
      setDeadlineTs(dl);
      deadlineRef.current = dl;

      const st = useMissingStore.getState();
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
          const results = rankContestants(useMissingStore.getState().contestants).map(s => ({
            user_id: s.contestant.id,
            name: s.contestant.name,
            score: s.contestant.score,
            rank: s.rank,
            is_winner: s.rank === 1,
          }));
          await finishGame(roomId, results, 'missing-xi');
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

  const question = questions[index];
  const isLast = index >= total - 1;

  const submit = useCallback(
    (value: string | null) => {
      const fraction =
        roomId && deadlineRef.current != null
          ? fractionRemaining(deadlineRef.current, Date.now())
          : Math.max(0, 1 - (Date.now() - startRef.current) / QUESTION_DURATION_MS);
      lockAnswer(value, fraction);
      if (!roomId) {
        reveal();
      } else if (isHost && contestants.length <= 1) {
        setDeadlineTs(Date.now());
      }
    },
    [roomId, isHost, contestants.length, lockAnswer, reveal],
  );

  const handleSubmit = useCallback(() => {
    const value = text.trim();
    submit(value.length > 0 ? value : null);
  }, [text, submit]);

  const handleTimeout = useCallback(() => {
    if (roomId) {
      lockAnswer(text.trim() || null, 0);
    } else {
      submit(text.trim() || null);
    }
  }, [roomId, text, lockAnswer, submit]);

  const advance = useCallback(() => {
    if (isLast) {
      navigation.replace('MissingXiPodium', {roomId, code});
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

  const hidden = question.players[question.hiddenIndex];
  const isCorrect = guess !== null && isCorrectGuess(guess, hidden);
  const heading = isCorrect ? 'Correct!' : guess === null ? "Time's up" : 'Wrong';

  return (
    <Screen>
      <ScreenHeader
        title={phase === 'standings' ? 'Standings' : `${question.team} ${question.year}`}
        subtitle={
          phase === 'standings'
            ? `Line-up ${index + 1} of ${total}`
            : `${question.competition} · ${question.formation}`
        }
      />

      {phase === 'standings' ? (
        <>
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
          <StickyFooter>
            {/* Solo lets you skip the wait; networked advances on the host clock. */}
            {!roomId ? (
              <Button label={isLast ? 'See podium' : 'Next line-up'} onPress={advance} />
            ) : (
              <View style={styles.footerSpacer} />
            )}
          </StickyFooter>
        </>
      ) : (
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
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
                  size={72}
                />
              )}
            </View>

            <Pitch
              players={question.players}
              formation={question.formation}
              hiddenIndex={question.hiddenIndex}
              reveal={phase === 'reveal'}
              guessedCorrectly={isCorrect}
            />

            {phase === 'reveal' ? (
              <Text variant="body" center style={styles.answer}>
                The missing player was {hidden.name}.
              </Text>
            ) : (
              <View style={styles.inputWrap}>
                <PlayerNameInput
                  value={text}
                  onChangeText={setText}
                  onSubmit={handleSubmit}
                  disabled={answered}
                />
                {answered && (
                  <Text variant="secondary" color="textSecondary" center style={styles.answer}>
                    {roomId && contestants.length > 1
                      ? 'Answer locked — waiting for the others…'
                      : 'Answer locked.'}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          <StickyFooter>
            {phase === 'question' && !answered ? (
              <Button label="Lock answer" onPress={handleSubmit} />
            ) : !roomId && phase === 'reveal' ? (
              <Button label="Continue" onPress={showStandings} />
            ) : (
              <View style={styles.footerSpacer} />
            )}
          </StickyFooter>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
  scroll: {flex: 1},
  content: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  standings: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  status: {
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  result: {gap: spacing.xs},
  inputWrap: {gap: spacing.sm},
  answer: {marginTop: spacing.sm},
  footerSpacer: {height: minTapTarget + 8},
});
