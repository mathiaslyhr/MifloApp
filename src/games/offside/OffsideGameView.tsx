/**
 * Offside's screen, for both ways of playing it.
 *
 * Online and pass-and-play render the SAME race: same cards, same clock, same
 * speed scoring. One shared phone only adds steps — a "pass the phone" gate in
 * front of each turn, so the cards stay hidden until it's your go. Everything
 * else here is written once.
 *
 * The split:
 * - `state` is the broadcast-safe public state. Offside has no secrets (the
 *   whole deck is on the room), but the shape holds anyway.
 * - `perspective` is who is holding the phone.
 *
 * Containers own state and transport (online: `subscribeRoom` + the 0017 RPCs;
 * local: `useState` + the pure engine). This view owns presentation and gating.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Button, Skeleton, Tag, Text, toast} from '../../core/ui';
import {haptics} from '../../core/haptics';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {GameShell, phaseStyles} from '../shared/GameShell';
import {PassGate, type PassGateSpec} from '../shared/localPlay';
import {CardGrid, CountdownBar, Scoreboard} from './components';
import {
  deltasOf,
  explanationFor,
  hasAnswered,
  missingNames,
  standings,
  topicKeyFor,
} from './engine';
import {fractionRemaining, scoreAnswer} from './scoring';
import {QUESTION_DURATION_MS} from './types';
import type {OffsideState} from './types';

/**
 * Who is holding the phone.
 * - `online`: one device per player — everyone races the same server deadline,
 *   so the view can name who it's still waiting on and mark your own answer.
 * - `local`: one shared phone — the race runs in turns and the reveal is for
 *   the whole table, so there is no "you" to mark.
 */
export type OffsidePerspective =
  | {kind: 'online'; myUserId: string | null}
  | {
      kind: 'local';
      actorUserId: string;
      /** 1-based place in the handoff round-trip. */
      handoff: {index: number; total: number};
    };

type Props = {
  /** Null while an online room primes over realtime, or before local setup deals. */
  state: OffsideState | null;
  perspective: OffsidePerspective;
  /**
   * Epoch ms. Online: the shared server-clock deadline. Local: the actor's
   * personal clock, started the moment THEY revealed the cards.
   */
  deadline: number | null;
  /** Non-null ⇒ render the gate instead of the phase body, keeping its chrome. */
  gate: PassGateSpec | null;
  onShowContent: () => void;
  /**
   * The actor's tap, or null at the deadline. Points are computed client-side
   * and re-verified server-side against the stored deck.
   */
  onSubmit: (option: number | null, points: number) => Promise<void>;
  /** reveal → scoreboard → next question / standings. */
  onAdvance: () => void;
  onPlayAgain: () => void;
  onExit: () => void;
  /** The standings' secondary action, and the back circle's label. */
  exitLabel: string;
  onBack: () => void;
  /** The standings show Play again + exit (online host; always local). */
  showResultActions: boolean;
  /** The reveal/scoreboard pagers are tappable (online host; always local). */
  canAdvance: boolean;
  /** Local swaps rule 2 — its race runs in turns, not all at once. */
  helpLines: {text: string}[];
  /** Local only: rendered while `state` is null. Online omits it for a skeleton. */
  setupSlot?: React.ReactNode;
};

export function OffsideGameView({
  state,
  perspective,
  deadline,
  gate,
  onShowContent,
  onSubmit,
  onAdvance,
  onPlayAgain,
  onExit,
  exitLabel,
  onBack,
  showResultActions,
  canAdvance,
  helpLines,
  setupSlot,
}: Props) {
  const {t} = useTranslation();

  // The question centres in the space below the header; the taller
  // reveal/scoreboard/standings top-align so they scroll normally.
  const topAlign = state != null && state.phase !== 'question';

  return (
    <GameShell
      title={t('offside.title')}
      backLabel={exitLabel}
      onBack={onBack}
      help={{title: t('offside.help.title'), lines: helpLines}}
      topAlign={topAlign}>
      {state === null ? (
        setupSlot ?? <PrimingSkeleton />
      ) : state.phase === 'question' ? (
        // Keyed per round online so the pick and timeout reset each question,
        // and per player-and-round locally so they reset for each turn. Not
        // keyed on myUserId: it starts null and resolving it would remount
        // mid-question.
        <QuestionPhase
          key={
            perspective.kind === 'local'
              ? `${state.round}:${perspective.actorUserId}`
              : String(state.round)
          }
          state={state}
          perspective={perspective}
          deadline={deadline}
          gate={gate}
          onShowContent={onShowContent}
          onSubmit={onSubmit}
        />
      ) : state.phase === 'reveal' ? (
        <RevealPhase
          state={state}
          perspective={perspective}
          canAdvance={canAdvance}
          onAdvance={onAdvance}
        />
      ) : state.phase === 'scoreboard' ? (
        <ScoreboardPhase
          state={state}
          canAdvance={canAdvance}
          onAdvance={onAdvance}
        />
      ) : (
        <StandingsPhase
          state={state}
          showResultActions={showResultActions}
          onPlayAgain={onPlayAgain}
          onExit={onExit}
          exitLabel={exitLabel}
        />
      )}
    </GameShell>
  );
}

/** Ghost round layout while an online room primes over realtime. */
function PrimingSkeleton() {
  const {t} = useTranslation();
  return (
    <View style={phaseStyles.phase} accessibilityLabel={t('offside.loading')}>
      <Skeleton width="60%" height={22} />
      <Skeleton width="100%" height={4} radius={2} />
      <Skeleton width="100%" height={92} />
      <Skeleton width="100%" height={92} />
    </View>
  );
}

/** The round pill both games wear above every phase. */
function RoundPill({round, total}: {round: number; total: number}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  return (
    <Tag style={styles.roundPill}>
      <Text variant="caption" color="muted" style={styles.roundText}>
        {t('offside.round', {round, total})}
      </Text>
    </Tag>
  );
}

/**
 * One question: four cards, a draining clock, one tap. The pick locks in
 * optimistically (rolled back if the submit fails) and scores itself off the
 * deadline; at zero an unanswered turn submits a blank so the round resolves
 * without waiting on the host's force fallback.
 */
function QuestionPhase({
  state,
  perspective,
  deadline,
  gate,
  onShowContent,
  onSubmit,
}: {
  state: OffsideState;
  perspective: OffsidePerspective;
  deadline: number | null;
  gate: PassGateSpec | null;
  onShowContent: () => void;
  onSubmit: (option: number | null, points: number) => Promise<void>;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [localPick, setLocalPick] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const isLocal = perspective.kind === 'local';
  const actorId =
    perspective.kind === 'local' ? perspective.actorUserId : perspective.myUserId;
  const round = state.deck[state.round - 1];
  const submitted =
    (!!actorId && hasAnswered(state, actorId)) || localPick != null;
  // What answered means for the grid: the confirmed pick, or the optimistic one
  // while the submit is in flight.
  const myOption =
    actorId != null ? state.answers[actorId]?.option ?? localPick : localPick;

  function pick(index: number) {
    if (submitted || round == null || deadline == null) {
      return;
    }
    haptics.press();
    const points = scoreAnswer(
      index === round.outlierIndex,
      fractionRemaining(deadline, Date.now()),
    );
    setLocalPick(index);
    onSubmit(index, points).catch(() => {
      setLocalPick(null);
      haptics.error();
      toast.error(t('offside.errorAnswer'));
    });
  }

  // At the deadline an unanswered turn turns in a blank (0 points). Dupes are
  // ignored — online the server drops them, locally the engine's
  // already-answered guard does — so the tap-vs-timeout race is safe either way.
  useEffect(() => {
    if (deadline == null) {
      return;
    }
    const timer = setTimeout(
      () => setTimedOut(true),
      Math.max(0, deadline - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [deadline]);
  useEffect(() => {
    if (timedOut && !submitted) {
      // Local buzzes for the blank HERE because its reveal is the whole table's
      // — there is no "you" to buzz at. Online's reveal already buzzes by how
      // your own round went, so buzzing here too would double up.
      if (isLocal) {
        haptics.error();
      }
      setLocalPick(-1); // sentinel: no tappable card matches, grid stays locked
      onSubmit(null, 0).catch(() => {});
    }
    // Intentionally not re-armed by `submitted`: once is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOut]);

  if (round == null) {
    return null;
  }

  const missing = missingNames(state);

  return (
    <View style={phaseStyles.phase}>
      <RoundPill round={state.round} total={state.rounds} />

      {gate ? (
        <PassGate spec={gate} onShow={onShowContent} />
      ) : (
        <>
          <Text variant="section" align="center" style={styles.headline}>
            {t('offside.question.prompt')}
          </Text>
          <Text
            variant="caption"
            color="muted"
            align="center"
            style={styles.topicText}>
            {t(topicKeyFor(round.criterion))}
          </Text>
          {deadline != null ? (
            <CountdownBar deadline={deadline} durationMs={QUESTION_DURATION_MS} />
          ) : null}
          <CardGrid
            cards={round.cards}
            selectedIndex={myOption != null && myOption >= 0 ? myOption : null}
            disabled={submitted}
            onPick={pick}
          />
          {submitted && !isLocal ? (
            // Only online is there a table to wait on: locally, answering IS
            // the pass, so there is nobody left to count.
            <Text variant="secondary" color="secondary" align="center">
              {timedOut && myOption == null
                ? t('offside.question.timeUp')
                : missing.length > 0
                ? t('offside.question.waitingNames', {
                    names: nameList(missing, t('offside.question.and')),
                  })
                : t('offside.question.waiting', {
                    count: state.answeredCount,
                    total: state.players.length,
                  })}
            </Text>
          ) : (
            <Text variant="secondary" color="secondary" align="center">
              {t('offside.question.hint')}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

/** "Anna", "Anna and Bo", "Anna, Bo and Carla" — the and-word is localized. */
function nameList(names: string[], andWord: string): string {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} ${andWord} ${names[names.length - 1]}`;
}

/**
 * The answer and the hidden link. Online it also reads your own verdict back to
 * you; on a shared phone there is no viewer, so it's the table's reveal only.
 */
function RevealPhase({
  state,
  perspective,
  canAdvance,
  onAdvance,
}: {
  state: OffsideState;
  perspective: OffsidePerspective;
  canAdvance: boolean;
  onAdvance: () => void;
}) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const round = state.deck[state.round - 1];
  if (round == null) {
    return null;
  }
  const isLocal = perspective.kind === 'local';
  const mine =
    !isLocal && perspective.myUserId != null
      ? state.answers[perspective.myUserId]
      : undefined;
  const correct = mine?.option != null && mine.option === round.outlierIndex;
  const explanation = explanationFor(round);
  return (
    <View style={phaseStyles.phase}>
      <RoundPill round={state.round} total={state.rounds} />

      {isLocal ? (
        <Text variant="secondary" color="secondary" align="center">
          {t('offside.local.revealIntro')}
        </Text>
      ) : (
        <>
          <Text
            variant="section"
            align="center"
            style={{color: correct ? colors.success : colors.error}}>
            {correct
              ? t('offside.reveal.correct')
              : mine?.option == null
              ? t('offside.reveal.noAnswer')
              : t('offside.reveal.wrong')}
          </Text>
          {correct && mine ? (
            <Text variant="body" align="center" style={styles.pointsLine}>
              {t('offside.reveal.points', {points: mine.points})}
            </Text>
          ) : null}
        </>
      )}

      <CardGrid
        cards={round.cards}
        selectedIndex={mine?.option ?? null}
        correctIndex={round.outlierIndex}
      />
      <Text variant="secondary" color="secondary" align="center">
        {t(explanation.key, explanation.params)}
      </Text>

      {canAdvance ? (
        <Button
          label={t('offside.reveal.showScoreboard')}
          variant="primary"
          onPress={onAdvance}
        />
      ) : (
        <Text variant="secondary" color="secondary" align="center">
          {t('offside.reveal.hostAdvances')}
        </Text>
      )}
    </View>
  );
}

/** The Kahoot beat: the leaderboard alone on screen between rounds. */
function ScoreboardPhase({
  state,
  canAdvance,
  onAdvance,
}: {
  state: OffsideState;
  canAdvance: boolean;
  onAdvance: () => void;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const lastRound = state.round >= state.rounds;
  return (
    <View style={phaseStyles.phase}>
      <RoundPill round={state.round} total={state.rounds} />
      <Text variant="section" align="center" style={styles.headline}>
        {t('offside.reveal.scoreboard')}
      </Text>

      <Scoreboard rows={standings(state)} deltas={deltasOf(state)} />

      {canAdvance ? (
        <Button
          label={
            lastRound
              ? t('offside.reveal.toStandings')
              : t('offside.reveal.next')
          }
          variant="primary"
          onPress={onAdvance}
        />
      ) : (
        <Text variant="secondary" color="secondary" align="center">
          {t('offside.reveal.hostAdvances')}
        </Text>
      )}
    </View>
  );
}

/** Final board. Run it back with a fresh deck (scores reset) or head out. */
function StandingsPhase({
  state,
  showResultActions,
  onPlayAgain,
  onExit,
  exitLabel,
}: {
  state: OffsideState;
  showResultActions: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
  exitLabel: string;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const board = standings(state);
  const winner = board[0];
  return (
    <View style={phaseStyles.phase}>
      {winner ? (
        <Text variant="wordmark" align="center" style={styles.headline}>
          {t('offside.standings.winner', {name: winner.name})}
        </Text>
      ) : null}
      <Scoreboard rows={board} deltas={{}} />
      {showResultActions ? (
        <View style={phaseStyles.resultActions}>
          <Button
            label={t('offside.playAgain')}
            variant="primary"
            onPress={onPlayAgain}
          />
          <Button label={exitLabel} variant="secondary" onPress={onExit} />
        </View>
      ) : (
        <Text
          variant="secondary"
          color="secondary"
          align="center"
          style={styles.waiting}>
          {t('offside.waitingHost')}
        </Text>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    // Quiet surface round pill, shared with Red Card's look.
    roundPill: {
      alignSelf: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    roundText: {letterSpacing: 1},
    headline: {color: c.ink},
    topicText: {letterSpacing: 1, marginTop: -spacing.sm},
    pointsLine: {color: c.success, marginTop: -spacing.sm},
    waiting: {marginTop: spacing.md},
  });
