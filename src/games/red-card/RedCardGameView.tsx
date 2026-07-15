/**
 * Red Card's screen, for both ways of playing it.
 *
 * Online and pass-and-play render the SAME hand: same role card, same question
 * rounds, same vote, same reveal. One shared phone only adds steps — a "pass the
 * phone" gate in front of every private moment, repeated once per player.
 * Everything else here is written once.
 *
 * THE SPLIT, and for this game it is the security model, not a convention:
 * - `state` is the broadcast-safe public state. It is typed `ImposterState`,
 *   which HAS NO `imposterId`/`footballerId` field — so reading a secret in
 *   here is a compile error, and no refactor can quietly put one on the wire.
 * - `perspective` is everything one pair of eyes may privately see, the role
 *   included. Online it comes off the server; locally, off the shared state.
 *
 * Containers own state and transport (online: `subscribeRoom` + the 0015 RPCs;
 * local: `useState` + the pure engine). This view owns presentation and gating.
 */
import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {
  Button,
  Card,
  Skeleton,
  Tag,
  Text,
  TextField,
  toast,
} from '../../core/ui';
import {haptics} from '../../core/haptics';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {getById} from '../../data/football';
import {GameShell, phaseStyles} from '../shared/GameShell';
import {PassGate, type PassGateSpec} from '../shared/localPlay';
import {useSearch} from '../shared/SearchScreen';
import {playerSource} from '../shared/searchSources';
import {FootballerCard} from './FootballerCard';
import {
  AnswerRevealBlock,
  PlayerGrid,
  Scoreboard,
  VotesBlock,
} from './components';
import {awaitingRedemption, cleanAnswer, nameOf, standings} from './engine';
import {ANSWER_MAX_LEN} from './types';
import type {ImposterRole, ImposterState} from './types';

/**
 * Who is looking at the screen.
 * - `online`: one device per player. The role comes from the server (never in
 *   the broadcast state) and is null while the fetch is in flight.
 * - `local`: one shared phone. The actor is whoever the phone was passed to and
 *   plays the exact part `myUserId` plays online; their role is read off the
 *   local state's secrets, so it is never null.
 */
export type RedCardPerspective =
  | {kind: 'online'; myUserId: string | null; role: ImposterRole | null}
  | {
      kind: 'local';
      actorUserId: string;
      role: ImposterRole;
      /** 1-based place in the handoff round-trip. */
      handoff: {index: number; total: number};
    };

type Props = {
  /** Null while an online room primes over realtime, or before local setup deals. */
  state: ImposterState | null;
  perspective: RedCardPerspective;
  /**
   * Non-null ⇒ render the gate INSTEAD of the current body, keeping the phase's
   * chrome. Not local-only: online uses it for the shared "Ready to vote?" beat.
   */
  gate: PassGateSpec | null;
  onShowContent: () => void;
  /** The role card is up for the current pair of eyes. */
  roleShown: boolean;
  /** Online: "Got it". Local: "Hide and pass on". */
  roleAckLabel: string;
  onRoleAck: () => void;
  /** Async so the view can roll `submitted` back if it never lands. */
  onSubmitAnswer: (text: string) => Promise<void>;
  onAdvanceAnswers: () => void;
  onVote: (targetUserId: string) => Promise<void>;
  /** The caught imposter's blind guess. */
  onGuess: (footballerId: string) => Promise<void>;
  /** Online only: this device already voted, so it waits on the rest. */
  hasVoted: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
  /** The reveal's secondary action, and the back circle's label. */
  exitLabel: string;
  onBack: () => void;
  /** The reveal shows Play again + exit (online host; always local). */
  showResultActions: boolean;
  /** The answer pager is tappable (online host; always local). */
  canPageAnswers: boolean;
  /** Local only: rendered while `state` is null. Online omits it for a skeleton. */
  setupSlot?: React.ReactNode;
};

export function RedCardGameView({
  state,
  perspective,
  gate,
  onShowContent,
  roleShown,
  roleAckLabel,
  onRoleAck,
  onSubmitAnswer,
  onAdvanceAnswers,
  onVote,
  onGuess,
  hasVoted,
  onPlayAgain,
  onExit,
  exitLabel,
  onBack,
  showResultActions,
  canPageAnswers,
  setupSlot,
}: Props) {
  const {t} = useTranslation();

  // The tall reveal top-aligns and scrolls; short phases centre.
  const topAlign = state?.phase === 'reveal';

  return (
    <GameShell
      title={t('redCard.title')}
      backLabel={exitLabel}
      onBack={onBack}
      help={{title: t('redCard.help.title'), lines: [{text: t('redCard.help.rule')}]}}
      topAlign={topAlign}>
      {state === null ? (
        setupSlot ?? <PrimingSkeleton />
      ) : state.phase === 'answering' ? (
        roleShown ? (
          // The role round-trip lives INSIDE the answering phase — it never
          // needed a phase of its own, online or local.
          <RolePhase
            gate={gate}
            onShowContent={onShowContent}
            role={perspective.role}
            roleAckLabel={roleAckLabel}
            onRoleAck={onRoleAck}
          />
        ) : (
          // Keyed per round online so the draft resets with each new question,
          // and per player-and-round locally so a draft never leaks to the next
          // pair of eyes. Not keyed on myUserId: it starts null and resolving it
          // would remount and wipe a half-typed answer.
          <AnsweringPhase
            key={
              perspective.kind === 'local'
                ? `${state.round}:${perspective.actorUserId}`
                : String(state.round)
            }
            state={state}
            perspective={perspective}
            gate={gate}
            onShowContent={onShowContent}
            onSubmitAnswer={onSubmitAnswer}
          />
        )
      ) : state.phase === 'answerReveal' ? (
        <AnswerRevealPhase
          state={state}
          perspective={perspective}
          canPageAnswers={canPageAnswers}
          onAdvance={onAdvanceAnswers}
        />
      ) : state.phase === 'voting' ? (
        <VotingPhase
          state={state}
          perspective={perspective}
          gate={gate}
          onShowContent={onShowContent}
          hasVoted={hasVoted}
          onVote={onVote}
        />
      ) : (
        <RevealPhase
          state={state}
          perspective={perspective}
          gate={gate}
          onShowContent={onShowContent}
          onGuess={onGuess}
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
    <View style={phaseStyles.phase} accessibilityLabel={t('redCard.loading')}>
      <Skeleton width="60%" height={22} />
      <Skeleton width="100%" height={120} />
      <Skeleton width="100%" height={52} />
      <Skeleton width="100%" height={52} />
    </View>
  );
}

/** The round pill above every phase. */
function RoundPill({label}: {label: string}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Tag style={styles.roundPill}>
      <Text variant="caption" color="muted" style={styles.roundText}>
        {label}
      </Text>
    </Tag>
  );
}

/**
 * One player's private role. Online each device sees its own once; locally the
 * phone goes around and each player sees theirs behind the gate. Same card
 * either way — the only difference is what the button says.
 */
function RolePhase({
  gate,
  onShowContent,
  role,
  roleAckLabel,
  onRoleAck,
}: {
  gate: PassGateSpec | null;
  onShowContent: () => void;
  /** Null only online, while the server round-trip is in flight. */
  role: ImposterRole | null;
  roleAckLabel: string;
  onRoleAck: () => void;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);

  if (gate) {
    return (
      <View style={phaseStyles.phase}>
        <PassGate spec={gate} onShow={onShowContent} />
      </View>
    );
  }

  return (
    <View style={phaseStyles.phase}>
      <Card style={styles.roleCard}>
        {role == null ? (
          // Online only: the role fetch is still in flight. The container
          // retries, so this never strands anyone behind a dead button.
          <View style={styles.roleLoading} accessibilityLabel={t('redCard.role.loading')}>
            <Skeleton width="50%" height={18} radius={9} />
            <Skeleton width="100%" height={64} />
          </View>
        ) : role.role === 'imposter' ? (
          <>
            <Text variant="title" align="center" style={styles.imposterTitle}>
              {t('redCard.role.imposterTitle')}
            </Text>
            <Text variant="body" color="secondary" align="center">
              {t('redCard.role.imposterBody')}
            </Text>
          </>
        ) : (
          <>
            <Text
              variant="caption"
              color="muted"
              align="center"
              style={styles.sectionLabel}>
              {t('redCard.role.detectiveIntro')}
            </Text>
            <FootballerCard footballerId={role.footballerId} />
          </>
        )}
        <Button
          label={roleAckLabel}
          variant="primary"
          disabled={role == null}
          onPress={() => {
            haptics.tap();
            onRoleAck();
          }}
        />
      </Card>
    </View>
  );
}

/**
 * One question round. Online the whole table types at once and then waits on the
 * shared count; locally the gated player types alone, and submitting IS the pass.
 */
function AnsweringPhase({
  state,
  perspective,
  gate,
  onShowContent,
  onSubmitAnswer,
}: {
  state: ImposterState;
  perspective: RedCardPerspective;
  gate: PassGateSpec | null;
  onShowContent: () => void;
  onSubmitAnswer: (text: string) => Promise<void>;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [draft, setDraft] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const clean = cleanAnswer(draft);
  const isOnline = perspective.kind === 'online';

  function submit() {
    if (!clean || submitted) {
      return;
    }
    setSubmitted(true);
    haptics.press();
    onSubmitAnswer(clean).catch(() => {
      setSubmitted(false);
      haptics.error();
      toast.error(t('redCard.errorAnswer'));
    });
  }

  return (
    <View style={phaseStyles.phase}>
      <RoundPill
        label={t('redCard.round', {round: state.round, total: state.rounds})}
      />

      {gate ? (
        <PassGate spec={gate} onShow={onShowContent} />
      ) : submitted && isOnline ? (
        // Only online is there a table to wait on: locally, submitting IS the
        // pass, so there is nobody left to count.
        <>
          <Text variant="section" align="center" style={styles.headline}>
            {t(`redCard.questions.${state.questionIds[state.round - 1]}`)}
          </Text>
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.answer.waiting', {
              count: state.answeredCount,
              total: state.players.length,
            })}
          </Text>
        </>
      ) : (
        <>
          <Text variant="section" align="center" style={styles.headline}>
            {t(`redCard.questions.${state.questionIds[state.round - 1]}`)}
          </Text>
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.answer.hint')}
          </Text>
          <TextField
            value={draft}
            onChangeText={setDraft}
            placeholder={t('redCard.answer.placeholder')}
            maxLength={ANSWER_MAX_LEN}
            onSubmitEditing={submit}
            accessibilityLabel={t('redCard.answer.placeholder')}
          />
          <Button
            label={t('redCard.answer.submit')}
            variant="primary"
            // `submitted` also guards the tap: without it a double-tap could
            // fire the submit twice.
            disabled={!clean || submitted}
            onPress={submit}
          />
        </>
      )}
    </View>
  );
}

/**
 * The round's answers, one by one with the author's name. Online the host reads
 * them out and pages; locally the phone goes in the middle and anyone pages.
 */
function AnswerRevealPhase({
  state,
  perspective,
  canPageAnswers,
  onAdvance,
}: {
  state: ImposterState;
  perspective: RedCardPerspective;
  canPageAnswers: boolean;
  onAdvance: () => void;
}) {
  const {t} = useTranslation();
  const answers = state.answers ?? [];
  const answer = answers[state.answerIndex];
  if (!answer) {
    return null;
  }
  const isLastAnswer = state.answerIndex >= answers.length - 1;
  const label = !isLastAnswer
    ? t('redCard.answers.next')
    : state.round < state.rounds
    ? t('redCard.answers.nextRound')
    : t('redCard.answers.toVote');
  return (
    <View style={phaseStyles.phase}>
      <RoundPill
        label={t('redCard.round', {round: state.round, total: state.rounds})}
      />
      <Text variant="secondary" color="secondary" align="center">
        {perspective.kind === 'local'
          ? t('redCard.local.revealIntro')
          : t(`redCard.questions.${state.questionIds[state.round - 1]}`)}
      </Text>
      <AnswerRevealBlock
        name={nameOf(state, answer.userId)}
        text={answer.text}
        index={state.answerIndex}
        total={answers.length}
      />
      {canPageAnswers ? (
        <Button label={label} variant="primary" onPress={onAdvance} />
      ) : (
        <Text variant="secondary" color="secondary" align="center">
          {t('redCard.answers.hostAdvances')}
        </Text>
      )}
    </View>
  );
}

/**
 * The vote. Both modes gate it: online everyone lands here at once, so an
 * ungated grid would let a fast tapper vote before reading; locally the gate is
 * the pass. Same component, different copy.
 */
function VotingPhase({
  state,
  perspective,
  gate,
  onShowContent,
  hasVoted,
  onVote,
}: {
  state: ImposterState;
  perspective: RedCardPerspective;
  gate: PassGateSpec | null;
  onShowContent: () => void;
  hasVoted: boolean;
  onVote: (targetUserId: string) => Promise<void>;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  // The voter never appears in their own grid.
  const actorId =
    perspective.kind === 'local' ? perspective.actorUserId : perspective.myUserId;

  return (
    <View style={phaseStyles.phase}>
      <RoundPill label={t('redCard.vote.pill')} />

      {gate ? (
        <PassGate spec={gate} onShow={onShowContent} />
      ) : hasVoted ? (
        <>
          <Text variant="section" align="center" style={styles.headline}>
            {t('redCard.vote.title')}
          </Text>
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.vote.waiting', {
              count: state.votedCount,
              total: state.players.length,
            })}
          </Text>
        </>
      ) : (
        <>
          <Text variant="section" align="center" style={styles.headline}>
            {t('redCard.vote.title')}
          </Text>
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.vote.hint')}
          </Text>
          <PlayerGrid
            players={state.players}
            excludeId={actorId}
            onPick={id => {
              haptics.press();
              onVote(id).catch(() => {
                haptics.error();
                toast.error(t('redCard.errorVote'));
              });
            }}
          />
        </>
      )}
    </View>
  );
}

/**
 * The end of the hand. A caught imposter first guesses the footballer BLIND —
 * the secret and the final results stay hidden until the guess is in — then
 * everything goes public: secret, points, and who voted for whom.
 */
function RevealPhase({
  state,
  perspective,
  gate,
  onShowContent,
  onGuess,
  showResultActions,
  onPlayAgain,
  onExit,
  exitLabel,
}: {
  state: ImposterState;
  perspective: RedCardPerspective;
  gate: PassGateSpec | null;
  onShowContent: () => void;
  onGuess: (footballerId: string) => Promise<void>;
  showResultActions: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
  exitLabel: string;
}) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const openSearch = useSearch();
  const reveal = state.reveal;
  if (!reveal) {
    return null;
  }
  const board = standings(state);
  const imposterName = nameOf(state, reveal.imposterId);
  const redemption = reveal.redemption;
  const awaitingGuess = awaitingRedemption(state);
  // Online: only the imposter's own device offers the guess. Local: the phone is
  // passed to them, so the actor IS the imposter by then.
  const amImposter = perspective.role?.role === 'imposter';

  function openPicker() {
    openSearch(playerSource(), {
      title: t('redCard.redeem.button'),
      placeholder: t('redCard.searchPlaceholder'),
      emptyHint: t('redCard.searchHint'),
      noMatch: t('redCard.noPlayers'),
    }).then(item => {
      if (!item) {
        return;
      }
      haptics.press();
      onGuess(item.id).catch(() => {
        haptics.error();
        toast.error(t('redCard.errorGuess'));
      });
    });
  }

  return (
    <View style={phaseStyles.phase}>
      <Text variant="wordmark" align="center" style={styles.headline}>
        {t('redCard.reveal.imposterWas', {name: imposterName})}
      </Text>
      <Text
        variant="section"
        align="center"
        style={{color: reveal.caught ? colors.success : colors.error}}>
        {reveal.caught ? t('redCard.reveal.caught') : t('redCard.reveal.escaped')}
      </Text>

      {awaitingGuess ? (
        amImposter ? (
          gate ? (
            <PassGate spec={gate} onShow={onShowContent} />
          ) : (
            <Card style={styles.redeemBox}>
              <Text variant="secondary" color="secondary" align="center">
                {t('redCard.redeem.prompt')}
              </Text>
              <Button
                label={t('redCard.redeem.button')}
                variant="primary"
                onPress={openPicker}
              />
            </Card>
          )
        ) : (
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.redeem.waiting', {name: imposterName})}
          </Text>
        )
      ) : (
        <>
          {redemption ? (
            <Text
              variant="section"
              align="center"
              style={{color: redemption.correct ? colors.success : colors.error}}>
              {redemption.correct
                ? t('redCard.redeem.correct', {name: imposterName})
                : t('redCard.redeem.wrong', {
                    name: imposterName,
                    guess: getById(redemption.guessId)?.name ?? '',
                  })}
            </Text>
          ) : null}

          <Text
            variant="caption"
            color="muted"
            align="center"
            style={styles.sectionLabel}>
            {t('redCard.reveal.secret')}
          </Text>
          <Card
            borderWidth={2}
            borderColor={
              redemption
                ? redemption.correct
                  ? colors.success
                  : colors.error
                : undefined
            }
            style={styles.revealFrame}>
            <FootballerCard footballerId={reveal.footballerId} />
          </Card>

          {/* Scoreboard — this hand's delta + running total, leader crowned. */}
          <Scoreboard rows={board} deltas={reveal.deltas} />

          {/* Votes — de-emphasised, no card chrome. */}
          <VotesBlock votes={reveal.votes} nameOf={id => nameOf(state, id)} />

          {showResultActions ? (
            <View style={phaseStyles.resultActions}>
              <Button
                label={t('redCard.playAgain')}
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
              {t('redCard.waitingHost')}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    // Quiet surface round pill.
    roundPill: {
      alignSelf: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    roundText: {letterSpacing: 1},
    headline: {color: c.ink},
    sectionLabel: {letterSpacing: 1, marginBottom: -spacing.sm},
    roleLoading: {gap: 12, alignItems: 'center'},
    roleCard: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 380,
      gap: spacing.lg,
      padding: spacing.xl,
    },
    imposterTitle: {color: c.error},
    redeemBox: {gap: spacing.sm, padding: spacing.md},
    // The revealed footballer sits in a single surface card; a guess tints its rim.
    revealFrame: {alignSelf: 'stretch', padding: spacing.lg},
    waiting: {marginTop: spacing.md},
  });
