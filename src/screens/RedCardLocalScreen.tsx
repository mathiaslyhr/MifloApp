import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
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
  Text,
  TextField,
  TopStatusFade,
} from '../core/ui';
import {haptics} from '../core/haptics';
import {
  screenPadding,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {getById} from '../data/football';
import {useSearch} from '../games/shared/SearchScreen';
import {playerSource} from '../games/shared/searchSources';
import {
  LOCAL_MAX_PLAYERS,
  PassGate,
  PlayerNamesEditor,
} from '../games/shared/localPlay';
import {FootballerCard} from '../games/red-card/FootballerCard';
import {
  AnswerRevealBlock,
  PlayerGrid,
  Scoreboard,
  VotesBlock,
} from '../games/red-card/components';
import {RoundsStepper} from '../games/shared/RoundsStepper';
import {cleanAnswer} from '../games/red-card/engine';
import {
  advanceLocalAnswerReveal,
  applyLocalRedemption,
  castLocalVote,
  createLocalGame,
  createLocalRematch,
  handoffPlayer,
  hideAndPass,
  LOCAL_MIN_PLAYERS,
  localNameOf,
  localStandings,
  showContent,
  submitLocalAnswer,
} from '../games/red-card/localEngine';
import {
  ANSWER_MAX_LEN,
  DEFAULT_ROUNDS,
  MAX_ROUNDS,
  MIN_ROUNDS,
} from '../games/red-card/types';
import type {LocalRedCardState} from '../games/red-card/localEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'RedCardLocal'>;

/**
 * Pass-and-play Red Card — the whole hand on one shared phone, fully offline.
 * Privacy comes from the handoff gate: the screen shows "Pass the phone to X"
 * until X taps, X sees their private content (role, answer box, or vote), and
 * it hides again before the next pass. Each round the app asks one question;
 * everyone types a secret answer, then the phone goes in the middle and the
 * answers come up one by one. Roles and scoring run in the pure local engine.
 */
export function RedCardLocalScreen({navigation}: Props) {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [state, setState] = useState<LocalRedCardState | null>(null);
  const [names, setNames] = useState<string[]>(['', '', '']);
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [showHelp, setShowHelp] = useState(false);
  const openSearch = useSearch();

  const namesReady =
    names.filter(n => n.trim().length > 0).length >= LOCAL_MIN_PLAYERS;

  function start() {
    if (!namesReady) {
      return;
    }
    haptics.press();
    setState(createLocalGame(names, rounds));
  }

  function openGuess() {
    openSearch(playerSource(), {
      title: t('redCard.redeem.button'),
      placeholder: t('redCard.searchPlaceholder'),
      emptyHint: t('redCard.searchHint'),
      noMatch: t('redCard.noPlayers'),
    }).then(item => {
      if (item) {
        submitGuess(item.id);
      }
    });
  }

  function submitGuess(footballerId: string) {
    haptics.press();
    setState(s => (s ? applyLocalRedemption(s, footballerId) : s));
  }

  const tallReveal = state?.stage === 'reveal';

  return (
    // Drop the top safe-area edge — the scroll content owns the top inset so the
    // wordmark scrolls away; back/help stay pinned as floating corner buttons.
    <Screen canvas edges={['left', 'right', 'bottom']}>
      {/* Lift the centered content above the keyboard while typing names or
          answers. */}
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

        {/* Short stages centre below the header; the tall reveal top-aligns. */}
        <View style={[styles.phaseWrap, tallReveal && styles.phaseWrapTop]}>
          {state === null ? (
            <SetupStage
              names={names}
              onChange={setNames}
              rounds={rounds}
              onRounds={setRounds}
              ready={namesReady}
              onStart={start}
            />
          ) : state.stage === 'roleReveal' ? (
            <RoleRevealStage state={state} onAdvance={setState} />
          ) : state.stage === 'answering' ? (
            // Keyed per player-and-round so the draft never leaks to the next
            // person the phone is passed to.
            <AnsweringStage
              key={`${state.round}:${state.handoffIndex}`}
              state={state}
              onAdvance={setState}
            />
          ) : state.stage === 'answerReveal' ? (
            <AnswerRevealStage state={state} onAdvance={setState} />
          ) : state.stage === 'voting' ? (
            <VotingStage state={state} onAdvance={setState} />
          ) : (
            <RevealStage
              state={state}
              onShowContent={() => setState(s => (s ? showContent(s) : s))}
              onGuess={openGuess}
              onPlayAgain={() => {
                haptics.press();
                setState(s => (s ? createLocalRematch(s) : s));
              }}
              onExit={() => navigation.goBack()}
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
            accessibilityLabel={t('redCard.local.exit')}
            onPress={() => navigation.goBack()}>
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

      <HowToPlayModal
        visible={showHelp}
        onClose={() => setShowHelp(false)}
        title={t('redCard.help.title')}
        lines={[{text: t('redCard.help.rule')}]}
      />
    </Screen>
  );
}

/** Name entry + round count: one field per player, add/remove rows, start at 3+. */
function SetupStage({
  names,
  onChange,
  rounds,
  onRounds,
  ready,
  onStart,
}: {
  names: string[];
  onChange: (names: string[]) => void;
  rounds: number;
  onRounds: (rounds: number) => void;
  ready: boolean;
  onStart: () => void;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.phase}>
      <Text variant="section" align="center" style={styles.headline}>
        {t('redCard.local.setupTitle')}
      </Text>
      <Text variant="secondary" color="secondary" align="center">
        {t('redCard.local.setupSub', {count: LOCAL_MIN_PLAYERS})}
      </Text>
      <PlayerNamesEditor
        names={names}
        onChange={onChange}
        minPlayers={LOCAL_MIN_PLAYERS}
        maxPlayers={LOCAL_MAX_PLAYERS}
        placeholder={t('redCard.local.namePlaceholder')}
        addLabel={t('redCard.local.addPlayer')}
        removeLabel={t('redCard.local.removePlayer')}
      />
      <RoundsStepper
        value={rounds}
        onChange={onRounds}
        min={MIN_ROUNDS}
        max={MAX_ROUNDS}
        label={t('redCard.roundsPicker.label')}
      />
      <Button
        label={t('redCard.local.start')}
        variant="primary"
        disabled={!ready}
        onPress={onStart}
      />
    </View>
  );
}

/** The phone goes around once; each player privately sees their role. */
function RoleRevealStage({
  state,
  onAdvance,
}: {
  state: LocalRedCardState;
  onAdvance: (next: LocalRedCardState) => void;
}) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const player = handoffPlayer(state);
  if (!player) {
    return null;
  }
  if (!state.contentShown) {
    return (
      <View style={styles.phase}>
        <PassGate
          title={t('redCard.local.passTo', {name: player.name})}
          sub={t('redCard.local.roleIntro', {name: player.name})}
          actionLabel={t('redCard.local.showRole')}
          onShow={() => onAdvance(showContent(state))}
        />
      </View>
    );
  }
  const isImposter = player.id === state.imposterId;
  return (
    <View style={styles.phase}>
      <GlassCard blur={28} tintColor={colors.glassStrong} style={styles.roleCard}>
        {isImposter ? (
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
            <FootballerCard footballerId={state.footballerId} />
          </>
        )}
        <Button
          label={t('redCard.local.hideAndPass')}
          variant="primary"
          onPress={() => {
            haptics.tap();
            onAdvance(hideAndPass(state));
          }}
        />
      </GlassCard>
    </View>
  );
}

/**
 * One question round: the phone goes around behind the pass gate and each
 * player privately types an answer to the same question.
 */
function AnsweringStage({
  state,
  onAdvance,
}: {
  state: LocalRedCardState;
  onAdvance: (next: LocalRedCardState) => void;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [draft, setDraft] = useState('');
  const player = handoffPlayer(state);
  if (!player) {
    return null;
  }
  const clean = cleanAnswer(draft);

  function submit() {
    if (!clean) {
      return;
    }
    haptics.press();
    onAdvance(submitLocalAnswer(state, clean));
  }

  return (
    <View style={styles.phase}>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('redCard.round', {round: state.round, total: state.rounds})}
        </Text>
      </GlassTag>
      {!state.contentShown ? (
        <PassGate
          title={t('redCard.local.passTo', {name: player.name})}
          sub={t('redCard.local.answerIntro')}
          actionLabel={t('redCard.local.showAnswer')}
          onShow={() => onAdvance(showContent(state))}
        />
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
            disabled={!clean}
            onPress={submit}
          />
        </>
      )}
    </View>
  );
}

/**
 * Phone in the middle: the round's answers come up one by one with the
 * author's name. Anyone taps past them; after the last one the button rolls
 * into the next question or the vote.
 */
function AnswerRevealStage({
  state,
  onAdvance,
}: {
  state: LocalRedCardState;
  onAdvance: (next: LocalRedCardState) => void;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const playerId = state.revealOrder[state.answerIndex];
  const text = state.answers[playerId];
  if (!playerId || text === undefined) {
    return null;
  }
  const isLastAnswer = state.answerIndex >= state.revealOrder.length - 1;
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
        {t('redCard.local.revealIntro')}
      </Text>
      <Text variant="secondary" color="secondary" align="center">
        {t(`redCard.questions.${state.questionIds[state.round - 1]}`)}
      </Text>
      <AnswerRevealBlock
        name={localNameOf(state, playerId)}
        text={text}
        index={state.answerIndex}
        total={state.revealOrder.length}
      />
      <Button
        label={label}
        variant="primary"
        onPress={() => {
          haptics.press();
          onAdvance(advanceLocalAnswerReveal(state));
        }}
      />
    </View>
  );
}

/** The phone goes around again; each player secretly taps their vote. */
function VotingStage({
  state,
  onAdvance,
}: {
  state: LocalRedCardState;
  onAdvance: (next: LocalRedCardState) => void;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const voter = handoffPlayer(state);
  if (!voter) {
    return null;
  }
  return (
    <View style={styles.phase}>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('redCard.vote.pill')}
        </Text>
      </GlassTag>
      {!state.contentShown ? (
        <PassGate
          title={t('redCard.local.passTo', {name: voter.name})}
          sub={t('redCard.local.voteIntro')}
          actionLabel={t('redCard.local.showVote')}
          onShow={() => onAdvance(showContent(state))}
        />
      ) : (
        <>
          <Text variant="section" align="center" style={styles.headline}>
            {t('redCard.vote.title')}
          </Text>
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.vote.hint')}
          </Text>
          <PlayerGrid
            players={state.players.map(p => ({userId: p.id, name: p.name}))}
            excludeId={voter.id}
            onPick={id => {
              haptics.press();
              onAdvance(castLocalVote(state, id));
            }}
          />
        </>
      )}
    </View>
  );
}

/**
 * The end of the hand. A caught imposter first gets the phone for a blind
 * redemption guess (secret + scoreboard stay hidden); then everything goes
 * public: secret footballer, points, and who voted for whom.
 */
function RevealStage({
  state,
  onShowContent,
  onGuess,
  onPlayAgain,
  onExit,
}: {
  state: LocalRedCardState;
  onShowContent: () => void;
  onGuess: () => void;
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const reveal = state.reveal;
  if (!reveal) {
    return null;
  }
  const imposterName = localNameOf(state, state.imposterId);
  const redemption = reveal.redemption;
  const awaitingGuess = state.stage === 'redemption';
  return (
    <View style={styles.phase}>
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
        !state.contentShown ? (
          <PassGate
            title={t('redCard.local.passTo', {name: imposterName})}
            sub={t('redCard.local.redeemPass')}
            actionLabel={t('redCard.redeem.button')}
            onShow={onShowContent}
          />
        ) : (
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
            <FootballerCard footballerId={state.footballerId} />
          </GlassCard>

          <Scoreboard
            rows={localStandings(state).map(r => ({
              userId: r.id,
              name: r.name,
              score: r.score,
            }))}
            deltas={reveal.deltas}
          />

          <VotesBlock votes={reveal.votes} nameOf={id => localNameOf(state, id)} />

          <View style={styles.resultActions}>
            <Button
              label={t('redCard.playAgain')}
              variant="primary"
              onPress={onPlayAgain}
            />
            <Button
              label={t('redCard.local.exit')}
              variant="secondary"
              onPress={onExit}
            />
          </View>
        </>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  flex: {flex: 1},
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
  // Centres the active stage below the header; the tall reveal top-aligns.
  phaseWrap: {flex: 1, justifyContent: 'center'},
  phaseWrapTop: {justifyContent: 'flex-start'},
  phase: {gap: spacing.lg, alignItems: 'stretch'},
  headline: {color: c.ink},
  // Quiet glass round pill — same as online Red Card.
  roundPill: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  roundText: {letterSpacing: 1},
  sectionLabel: {letterSpacing: 1, marginBottom: -spacing.sm},
  // Private role card — same frosted recipe as the online role overlay.
  roleCard: {gap: spacing.lg, padding: spacing.xl},
  imposterTitle: {color: c.error},
  redeemBox: {gap: spacing.sm, padding: spacing.md},
  // The revealed footballer sits in a single glass card; a caught guess tints its rim.
  revealFrame: {alignSelf: 'stretch', padding: spacing.lg},
  resultActions: {gap: spacing.md, marginTop: spacing.sm},
  });
