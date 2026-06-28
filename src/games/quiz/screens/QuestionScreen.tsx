import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Button, Screen, ScreenHeader, StickyFooter, Text} from '../../../core/ui';
import {minTapTarget, spacing} from '../../../theme';
import type {RootStackParamList} from '../../../core/navigation/types';
import {getById} from '../../../data/football';
import {AnswerOption, type AnswerState} from '../components/AnswerOption';
import {StandingRow} from '../components/StandingRow';
import {TimerRing} from '../components/TimerRing';
import {
  QUESTION_DURATION_MS,
  REVEAL_DURATION_MS,
  STANDINGS_DURATION_MS,
  rankContestants,
} from '../scoring';
import {useQuizStore} from '../store';

type Props = NativeStackScreenProps<RootStackParamList, 'QuizQuestion'>;

/**
 * The whole in-round screen, driven by `phase`: question → reveal → standings,
 * all without navigation so nothing jumps mid-round. Each phase auto-advances on
 * a timer (the footer button just skips the wait); in M3 those transitions come
 * from the host's Realtime broadcast instead of these local timers.
 */
export function QuestionScreen({navigation, route}: Props) {
  const {code, topicIds, count} = route.params;
  const questions = useQuizStore(s => s.questions);
  const index = useQuizStore(s => s.index);
  const total = useQuizStore(s => s.count);
  const phase = useQuizStore(s => s.phase);
  const selected = useQuizStore(s => s.selected);
  const lastPoints = useQuizStore(s => s.lastPoints);
  const you = useQuizStore(s => s.you);
  const prevRankById = useQuizStore(s => s.prevRankById);
  const lockAnswer = useQuizStore(s => s.lockAnswer);
  const reveal = useQuizStore(s => s.reveal);
  const showStandings = useQuizStore(s => s.showStandings);
  const next = useQuizStore(s => s.next);
  const start = useQuizStore(s => s.start);

  // Safety net if reached without a deck (e.g. dev fast-refresh); the normal
  // path starts the game from the Lobby.
  useEffect(() => {
    if (questions.length === 0) {
      start(topicIds ?? [], count ?? 10, 'You');
    }
  }, [questions.length, start, topicIds, count]);

  const startRef = useRef(Date.now());
  useEffect(() => {
    startRef.current = Date.now();
  }, [index]);

  const question = questions[index];
  const isLast = index >= total - 1;

  const submit = useCallback(
    (optionIndex: number | null) => {
      const elapsed = Date.now() - startRef.current;
      const fraction = Math.max(0, 1 - elapsed / QUESTION_DURATION_MS);
      lockAnswer(optionIndex, fraction);
      reveal();
    },
    [lockAnswer, reveal],
  );

  const handleTimeout = useCallback(() => submit(null), [submit]);

  const advance = useCallback(() => {
    if (isLast) {
      navigation.replace('QuizPodium', {code});
    } else {
      next();
    }
  }, [isLast, navigation, code, next]);

  // Auto-advance the timed phases; the footer button calls the same handlers.
  useEffect(() => {
    if (phase === 'reveal') {
      const id = setTimeout(showStandings, REVEAL_DURATION_MS);
      return () => clearTimeout(id);
    }
    if (phase === 'standings') {
      const id = setTimeout(advance, STANDINGS_DURATION_MS);
      return () => clearTimeout(id);
    }
  }, [phase, index, showStandings, advance]);

  const standings = useMemo(
    () => rankContestants([you], prevRankById),
    [you, prevRankById],
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
                disabled={phase !== 'question'}
              />
            ))}
          </View>

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
        {phase === 'reveal' && (
          <Button label="Continue" onPress={showStandings} />
        )}
        {phase === 'standings' && (
          <Button label={isLast ? 'See podium' : 'Next question'} onPress={advance} />
        )}
        {phase === 'question' && <View style={styles.footerSpacer} />}
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
