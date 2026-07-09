import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {ChevronLeft, HelpCircle} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Button,
  CircleButton,
  FloatingBar,
  GlassCard,
  GlassTag,
  HowToPlayModal,
  Screen,
  Skeleton,
  Text,
  TextField,
  toast,
  TopStatusFade,
} from '../core/ui';
import {haptics} from '../core/haptics';
import {colors, screenPadding, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {
  castRedCardVote,
  getMyRedCardRole,
  redCardGuess,
  playMove,
  restartRedCardGame,
  returnToLobby,
  submitRedCardAnswer,
  subscribeRoom,
  type ImposterRoleResult,
} from '../core/rooms/roomService';
import {createConnectionNotifier} from '../core/rooms/connectionStatus';
import {ensureSession} from '../core/supabase/client';
import {getById} from '../data/football';
import {FootballerSearchModal} from '../games/shared/FootballerSearchModal';
import {FootballerCard} from '../games/red-card/FootballerCard';
import {
  AnswerRevealBlock,
  PlayerGrid,
  Scoreboard,
  VotesBlock,
} from '../games/red-card/components';
import {
  advanceAnswerReveal,
  buildFootballerPool,
  cleanAnswer,
  nameOf,
  standings,
} from '../games/red-card/engine';
import {
  noteSessionQuestions,
  takeSessionQuestions,
} from '../games/red-card/questions';
import {ANSWER_MAX_LEN} from '../games/red-card/types';
import type {ImposterState} from '../games/red-card/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RedCard'>;

export function RedCardScreen({route, navigation}: Props) {
  const {roomId} = route.params;
  const {t} = useTranslation();
  const [state, setState] = useState<ImposterState | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [role, setRole] = useState<ImposterRoleResult | null>(null);
  const [roleDismissed, setRoleDismissed] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [guessOpen, setGuessOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const insets = useSafeAreaInsets();
  const leftRef = useRef(false);
  const prevPhaseRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    ensureSession().then(setMyUserId).catch(() => {});
    const unsub = subscribeRoom(
      roomId,
      room => {
        setHostId(room.hostId);
        // Host returned the party to the lobby / ended the game → follow back.
        if (room.status !== 'in_progress' || !room.gameState) {
          if (!leftRef.current) {
            leftRef.current = true;
            navigation.goBack();
          }
          return;
        }
        setState(room.gameState as ImposterState);
      },
      // Host left the party entirely (no host, no party) → back to the menu.
      () => {
        if (!leftRef.current) {
          leftRef.current = true;
          navigation.popToTop();
        }
      },
      createConnectionNotifier(),
    );
    return unsub;
  }, [roomId, navigation]);

  // Fetch ONLY my own role from the server (never in the broadcast state). The
  // secret is written before the room flips to in_progress, but retry once in
  // case this device sees the state first. On failure, say so and quietly try
  // once more after a beat — otherwise a blip strands the player behind the
  // "Dealing roles…" overlay with a disabled button.
  const fetchRole = useCallback(() => {
    const fail = () => {
      haptics.error();
      toast.error(t('redCard.errorRole'));
      setTimeout(() => {
        getMyRedCardRole(roomId)
          .then(r => r && setRole(r))
          .catch(() => {});
      }, 2000);
    };
    getMyRedCardRole(roomId)
      .then(r => {
        if (r) {
          setRole(r);
        } else {
          setTimeout(() => {
            getMyRedCardRole(roomId)
              .then(rr => rr && setRole(rr))
              .catch(fail);
          }, 600);
        }
      })
      .catch(fail);
  }, [roomId, t]);

  // A hand always opens in the 'answering' phase. Reset per-hand local state
  // and re-fetch the role only when a hand starts fresh — on first mount or on
  // Play again after a reveal (which re-randomises the imposter and
  // footballer). Coming back from 'answerReveal' is just the next round of the
  // SAME hand, so nothing resets.
  useEffect(() => {
    if (!state) {
      return;
    }
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;
    const freshHand = prev === undefined || prev === 'reveal';
    if (state.phase === 'answering' && freshHand) {
      setRole(null);
      setRoleDismissed(false);
      setHasVoted(false);
      fetchRole();
    } else if (prev === undefined) {
      // Mounted mid-hand (force-quit + rejoin): recover this device's role
      // without resetting the per-hand flags.
      fetchRole();
    }
  }, [state?.phase, state, fetchRole]);

  const isHost = !!myUserId && myUserId === hostId;

  // Shared catch for room RPCs: the action never reached the server (offline,
  // timeout), so buzz and say so instead of failing silently.
  function notifyNetworkError() {
    haptics.error();
    toast.error(t('common.errorNetwork'));
  }

  function handleBack() {
    if (isHost) {
      returnToLobby(roomId).catch(notifyNetworkError);
    } else {
      leftRef.current = true;
      navigation.goBack();
    }
  }

  if (!state) {
    return (
      <Screen canvas edges={['left', 'right', 'bottom']}>
        {/* Ghost round layout while the room state primes over realtime. */}
        <View style={styles.loading} accessibilityLabel={t('redCard.loading')}>
          <View style={styles.loadingStack}>
            <Skeleton width="60%" height={22} />
            <Skeleton width="100%" height={120} />
            <Skeleton width="100%" height={52} />
            <Skeleton width="100%" height={52} />
          </View>
        </View>
        <FloatingBar edge="top" style={styles.chromeBar}>
          <View style={styles.chromeRow}>
            <CircleButton
              size={36}
              accessibilityLabel={t('redCard.backToLobby')}
              onPress={handleBack}>
              <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
            </CircleButton>
          </View>
        </FloatingBar>
        <TopStatusFade />
      </Screen>
    );
  }

  // Host pages the one-by-one answer reveal; the server put the turn on the
  // host when the round resolved, so play_move only accepts the host here.
  function advanceReveal() {
    if (!state) {
      return;
    }
    haptics.press();
    playMove(roomId, advanceAnswerReveal(state)).catch(notifyNetworkError);
  }

  function castVote(targetUserId: string) {
    if (hasVoted) {
      return;
    }
    setHasVoted(true);
    haptics.press();
    castRedCardVote(roomId, targetUserId).catch(() => {
      setHasVoted(false);
      toast.error(t('redCard.errorVote'));
    });
  }

  function submitGuess(footballerId: string) {
    setGuessOpen(false);
    haptics.press();
    redCardGuess(roomId, footballerId).catch(() => {
      toast.error(t('redCard.errorGuess'));
    });
  }

  async function playAgain() {
    if (!state) {
      return;
    }
    try {
      // Make sure the current hand is in the party's ask history even if the
      // app restarted mid-session, then deal questions it hasn't heard yet.
      noteSessionQuestions(roomId, state.questionIds);
      await restartRedCardGame(
        roomId,
        buildFootballerPool(),
        state.rounds,
        takeSessionQuestions(roomId, state.rounds),
      );
    } catch {
      toast.error(t('redCard.newGameError'));
    }
  }

  const showRoleOverlay = state.phase === 'answering' && !roleDismissed;

  return (
    // Drop the top safe-area edge — the scroll content owns the top inset so the
    // wordmark scrolls away; back/help stay pinned as floating corner buttons.
    <Screen canvas edges={['left', 'right', 'bottom']}>
      {/* Lift the centered content above the keyboard while typing an answer. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          {paddingTop: insets.top + spacing.sm},
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Wordmark header — in the scroll flow, so it scrolls off the top. */}
        <View style={styles.titleHeader}>
          <Text variant="wordmark" align="center">
            {t('redCard.title')}
          </Text>
        </View>

        {/* Short phases (answering/voting) centre in the space below the
            header; the tall reveal top-aligns so it scrolls normally. */}
        <View
          style={[
            styles.phaseWrap,
            state.phase === 'reveal' && styles.phaseWrapTop,
          ]}>
          {state.phase === 'answering' ? (
            // Keyed per round so the draft and submitted flag reset with each
            // new question.
            <AnsweringPhase
              key={state.round}
              state={state}
              onSubmit={text => submitRedCardAnswer(roomId, text)}
            />
          ) : state.phase === 'answerReveal' ? (
            <AnswerRevealPhase
              state={state}
              isHost={isHost}
              onAdvance={advanceReveal}
            />
          ) : state.phase === 'voting' ? (
            <VotingPhase
              state={state}
              myUserId={myUserId}
              hasVoted={hasVoted}
              onVote={castVote}
            />
          ) : (
            <RevealPhase
              state={state}
              isHost={isHost}
              amImposter={role?.role === 'imposter'}
              onGuess={() => setGuessOpen(true)}
              onPlayAgain={playAgain}
              onBackToLobby={() => returnToLobby(roomId).catch(notifyNetworkError)}
            />
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Pinned floating corner buttons (back left, help right) — stay put while
          the wordmark scrolls away. */}
      <FloatingBar edge="top" style={styles.chromeBar}>
        <View style={styles.chromeRow}>
          <CircleButton
            size={36}
            accessibilityLabel={t('redCard.backToLobby')}
            onPress={handleBack}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
          <View style={styles.chromeSpacer} />
          <CircleButton
            size={36}
            accessibilityLabel={t('redCard.help.title')}
            onPress={() => setShowHelp(true)}>
            <HelpCircle size={18} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        </View>
      </FloatingBar>
      <TopStatusFade />

      {/* Private role reveal — each device shows only its own role. */}
      <Modal visible={showRoleOverlay} transparent animationType="fade">
        <View style={styles.roleScrim}>
          <GlassCard
            blur={28}
            tintColor="rgba(255,255,255,0.6)"
            style={styles.roleCard}>
            {role == null ? (
              <View
                style={styles.roleLoading}
                accessibilityLabel={t('redCard.role.loading')}>
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
              label={t('redCard.role.gotIt')}
              variant="primary"
              disabled={role == null}
              onPress={() => setRoleDismissed(true)}
            />
          </GlassCard>
        </View>
      </Modal>

      {/* Imposter redemption — search any footballer. */}
      <FootballerSearchModal
        visible={guessOpen}
        title={t('redCard.redeem.button')}
        titleVariant="section"
        placeholder={t('redCard.searchPlaceholder')}
        hint={t('redCard.searchHint')}
        empty={t('redCard.noPlayers')}
        onPick={submitGuess}
        onClose={() => setGuessOpen(false)}
      />

      <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </Screen>
  );
}


/**
 * The whole table gets the same question; each device types one secret answer.
 * After submitting, the screen waits on the shared answered count until the
 * server flips the round into the reveal.
 */
function AnsweringPhase({
  state,
  onSubmit,
}: {
  state: ImposterState;
  onSubmit: (text: string) => Promise<void>;
}) {
  const {t} = useTranslation();
  const [draft, setDraft] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const clean = cleanAnswer(draft);

  function submit() {
    if (!clean || submitted) {
      return;
    }
    setSubmitted(true);
    haptics.press();
    onSubmit(clean).catch(() => {
      setSubmitted(false);
      haptics.error();
      toast.error(t('redCard.errorAnswer'));
    });
  }

  return (
    <View style={styles.phase}>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('redCard.round', {round: state.round, total: state.rounds})}
        </Text>
      </GlassTag>
      <Text variant="section" align="center" style={styles.headline}>
        {t(`redCard.questions.${state.questionIds[state.round - 1]}`)}
      </Text>

      {submitted ? (
        <Text variant="secondary" color="secondary" align="center">
          {t('redCard.answer.waiting', {
            count: state.answeredCount,
            total: state.players.length,
          })}
        </Text>
      ) : (
        <>
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
            disabled={!clean}
            onPress={submit}
          />
        </>
      )}
    </View>
  );
}

/**
 * The round's answers, one by one with the author's name. The host reads them
 * out and pages through; after the last answer the button rolls into the next
 * question or the vote.
 */
function AnswerRevealPhase({
  state,
  isHost,
  onAdvance,
}: {
  state: ImposterState;
  isHost: boolean;
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
    <View style={styles.phase}>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('redCard.round', {round: state.round, total: state.rounds})}
        </Text>
      </GlassTag>
      <Text variant="secondary" color="secondary" align="center">
        {t(`redCard.questions.${state.questionIds[state.round - 1]}`)}
      </Text>
      <AnswerRevealBlock
        name={nameOf(state, answer.userId)}
        text={answer.text}
        index={state.answerIndex}
        total={answers.length}
      />
      {isHost ? (
        <Button label={label} variant="primary" onPress={onAdvance} />
      ) : (
        <Text variant="secondary" color="secondary" align="center">
          {t('redCard.answers.hostAdvances')}
        </Text>
      )}
    </View>
  );
}

function VotingPhase({
  state,
  myUserId,
  hasVoted,
  onVote,
}: {
  state: ImposterState;
  myUserId: string | null;
  hasVoted: boolean;
  onVote: (userId: string) => void;
}) {
  const {t} = useTranslation();
  // Shared "finished" beat: when everyone lands on voting, show a ready screen
  // first, then reveal the vote grid on tap.
  const [started, setStarted] = useState(false);
  return (
    <View style={styles.phase}>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('redCard.vote.pill')}
        </Text>
      </GlassTag>
      {hasVoted ? (
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
      ) : !started ? (
        <>
          <Text variant="section" align="center" style={styles.headline}>
            {t('redCard.vote.ready')}
          </Text>
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.vote.readySub')}
          </Text>
          <Button
            label={t('redCard.vote.start')}
            variant="primary"
            onPress={() => setStarted(true)}
          />
        </>
      ) : (
        <>
          <Text variant="section" align="center" style={styles.headline}>
            {t('redCard.vote.title')}
          </Text>
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.vote.hint')}
          </Text>
          <PlayerGrid players={state.players} excludeId={myUserId} onPick={onVote} />
        </>
      )}
    </View>
  );
}

function RevealPhase({
  state,
  isHost,
  amImposter,
  onGuess,
  onPlayAgain,
  onBackToLobby,
}: {
  state: ImposterState;
  isHost: boolean;
  amImposter: boolean;
  onGuess: () => void;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}) {
  const {t} = useTranslation();
  const reveal = state.reveal;
  if (!reveal) {
    return null;
  }
  const board = standings(state);
  const redeemedName = nameOf(state, reveal.imposterId);
  const redemption = reveal.redemption;
  // A caught imposter guesses the footballer BLIND — hide the secret and the
  // final results until the guess is in. (An escaped imposter has nothing to
  // guess, so the reveal resolves immediately.)
  const awaitingGuess = reveal.caught && !redemption;
  return (
    <View style={styles.phase}>
      <Text variant="wordmark" align="center" style={styles.headline}>
        {t('redCard.reveal.imposterWas', {name: redeemedName})}
      </Text>
      <Text
        variant="section"
        align="center"
        style={{color: reveal.caught ? colors.success : colors.error}}>
        {reveal.caught ? t('redCard.reveal.caught') : t('redCard.reveal.escaped')}
      </Text>

      {awaitingGuess ? (
        amImposter ? (
          <GlassCard style={styles.redeemBox}>
            <Text variant="secondary" color="secondary" align="center">
              {t('redCard.redeem.prompt')}
            </Text>
            <Button
              label={t('redCard.redeem.button')}
              variant="primary"
              onPress={onGuess}
            />
          </GlassCard>
        ) : (
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.redeem.waiting', {name: redeemedName})}
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
                ? t('redCard.redeem.correct', {name: redeemedName})
                : t('redCard.redeem.wrong', {
                    name: redeemedName,
                    guess: getById(redemption.guessId)?.name ?? '',
                  })}
            </Text>
          ) : null}

          <Text variant="caption" color="muted" align="center" style={styles.sectionLabel}>
            {t('redCard.reveal.secret')}
          </Text>
          <GlassCard
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
          </GlassCard>

          {/* Scoreboard — this round's delta + running total, leader crowned. */}
          <Scoreboard rows={board} deltas={reveal.deltas} />

          {/* Votes — de-emphasised, no card chrome. */}
          <VotesBlock votes={reveal.votes} nameOf={id => nameOf(state, id)} />

          {isHost ? (
            <View style={styles.resultActions}>
              <Button
                label={t('redCard.playAgain')}
                variant="primary"
                onPress={onPlayAgain}
              />
              <Button label={t('redCard.backToLobby')} variant="secondary" onPress={onBackToLobby} />
            </View>
          ) : (
            <Text variant="secondary" color="secondary" align="center" style={styles.waiting}>
              {t('redCard.waitingHost')}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

/** Lightweight how-to-play sheet — the shared app-wide popover. */
function HelpModal({visible, onClose}: {visible: boolean; onClose: () => void}) {
  const {t} = useTranslation();
  return (
    <HowToPlayModal
      visible={visible}
      onClose={onClose}
      title={t('redCard.help.title')}
      lines={[{text: t('redCard.help.rule')}]}
    />
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  loadingStack: {width: '100%', gap: 12},
  roleLoading: {gap: 12, alignItems: 'center'},
  // Scroll-away wordmark row.
  titleHeader: {height: 44, alignItems: 'center', justifyContent: 'center'},
  // Pinned floating corner buttons (back left, help right).
  chromeBar: {paddingHorizontal: screenPadding},
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    marginTop: spacing.sm,
  },
  chromeSpacer: {flex: 1},
  body: {flexGrow: 1, paddingBottom: spacing.xl, gap: spacing.lg},
  // Centres the active phase in the space between the header and the bug link.
  phaseWrap: {flex: 1, justifyContent: 'center'},
  phaseWrapTop: {justifyContent: 'flex-start'},
  phase: {gap: spacing.lg, alignItems: 'stretch'},
  // Quiet glass round pill (was heavy near-black ink).
  roundPill: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  roundText: {letterSpacing: 1},
  headline: {color: colors.ink},
  sectionLabel: {letterSpacing: 1, marginBottom: -spacing.sm},
  redeemBox: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  // The revealed footballer sits in a single glass card; a caught guess tints its rim.
  revealFrame: {
    alignSelf: 'stretch',
    padding: spacing.lg,
  },
  votesBlock: {gap: 2, marginTop: spacing.xs, paddingHorizontal: spacing.sm},
  votesLabel: {letterSpacing: 1, marginBottom: spacing.xs},
  voteLine: {paddingVertical: 1},
  resultActions: {gap: spacing.md, marginTop: spacing.sm},
  waiting: {marginTop: spacing.md},
  // Role reveal overlay: a dim backdrop + a centered, frosted card.
  roleScrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  roleCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 380,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  imposterTitle: {color: colors.error},
});
