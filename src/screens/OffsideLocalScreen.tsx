import React, {useEffect, useState} from 'react';
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
  GlassTag,
  HowToPlayModal,
  Screen,
  Text,
  toast,
  TopStatusFade,
} from '../core/ui';
import {haptics} from '../core/haptics';
import {colors, screenPadding, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {
  LOCAL_MAX_PLAYERS,
  PassGate,
  PlayerNamesEditor,
} from '../games/shared/localPlay';
import {
  CardGrid,
  CountdownBar,
  Scoreboard,
} from '../games/offside/components';
import {RoundsStepper} from '../games/shared/RoundsStepper';
import {
  deltasOf,
  explanationFor,
  standings,
  topicKeyFor,
} from '../games/offside/engine';
import {
  advanceLocalOffside,
  createLocalOffsideGame,
  createLocalOffsideRematch,
  handoffPlayer,
  LOCAL_MIN_PLAYERS,
  revealQuestion,
  submitLocalAnswer,
} from '../games/offside/localEngine';
import {
  DEFAULT_ROUNDS,
  MAX_ROUNDS,
  MIN_ROUNDS,
  QUESTION_DURATION_MS,
} from '../games/offside/types';
import type {LocalOffsideState} from '../games/offside/localEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'OffsideLocal'>;

/**
 * Pass-and-play Offside — the race in turns on one shared phone, fully
 * offline. The handoff gate hides the four cards; each player's personal 20
 * second clock only starts when THEY reveal them, and the shared scoring maths
 * makes a turn worth exactly what it would be online. After the last turn the
 * phone goes in the middle for the open reveal and scoreboard.
 */
export function OffsideLocalScreen({navigation}: Props) {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<LocalOffsideState | null>(null);
  const [names, setNames] = useState<string[]>(['', '']);
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [showHelp, setShowHelp] = useState(false);

  const namesReady =
    names.filter(n => n.trim().length > 0).length >= LOCAL_MIN_PLAYERS;

  function start() {
    if (!namesReady) {
      return;
    }
    haptics.press();
    try {
      setState(createLocalOffsideGame(names, rounds));
    } catch {
      toast.error(t('offside.newGameError'));
    }
  }

  function playAgain() {
    haptics.press();
    try {
      setState(s => (s ? createLocalOffsideRematch(s) : s));
    } catch {
      toast.error(t('offside.newGameError'));
    }
  }

  function advance() {
    haptics.press();
    setState(s => (s ? advanceLocalOffside(s) : s));
  }

  return (
    // Drop the top safe-area edge — the scroll content owns the top inset so the
    // wordmark scrolls away; back/help stay pinned as floating corner buttons.
    <Screen canvas edges={['left', 'right', 'bottom']}>
      {/* Lift the centered content above the keyboard while typing names. */}
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
              {t('offside.title')}
            </Text>
          </View>

          {/* Short stages centre below the header; tall boards top-align. */}
          <View
            style={[
              styles.phaseWrap,
              state !== null && state.stage !== 'question' && styles.phaseWrapTop,
            ]}>
            {state === null ? (
              <SetupStage
                names={names}
                onChange={setNames}
                rounds={rounds}
                onRounds={setRounds}
                ready={namesReady}
                onStart={start}
              />
            ) : state.stage === 'question' ? (
              // Keyed per player-and-round so the timeout resets each turn.
              <QuestionStage
                key={`${state.round}:${state.handoffIndex}`}
                state={state}
                onAdvance={setState}
              />
            ) : state.stage === 'reveal' ? (
              <RevealStage state={state} onAdvance={advance} />
            ) : state.stage === 'scoreboard' ? (
              <ScoreboardStage state={state} onAdvance={advance} />
            ) : (
              <StandingsStage
                state={state}
                onPlayAgain={playAgain}
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
            accessibilityLabel={t('offside.local.exit')}
            onPress={() => navigation.goBack()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
          <View style={styles.chromeSpacer} />
          <CircleButton
            size={36}
            accessibilityLabel={t('offside.help.title')}
            onPress={() => setShowHelp(true)}>
            <HelpCircle size={18} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        </View>
      </FloatingBar>
      <TopStatusFade />

      <HowToPlayModal
        visible={showHelp}
        onClose={() => setShowHelp(false)}
        title={t('offside.help.title')}
        lines={[
          {text: t('offside.help.rule1')},
          // Local variant: it's turns on one phone, not a simultaneous race.
          {text: t('offside.local.helpRule2')},
          {text: t('offside.help.rule3')},
        ]}
      />
    </Screen>
  );
}

/** Name entry + round count: one field per player, add/remove rows, start at 2+. */
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
  return (
    <View style={styles.phase}>
      <Text variant="section" align="center" style={styles.headline}>
        {t('offside.local.setupTitle')}
      </Text>
      <Text variant="secondary" color="secondary" align="center">
        {t('offside.local.setupSub', {count: LOCAL_MIN_PLAYERS})}
      </Text>
      <PlayerNamesEditor
        names={names}
        onChange={onChange}
        minPlayers={LOCAL_MIN_PLAYERS}
        maxPlayers={LOCAL_MAX_PLAYERS}
        placeholder={t('offside.local.namePlaceholder')}
        addLabel={t('offside.local.addPlayer')}
        removeLabel={t('offside.local.removePlayer')}
      />
      <RoundsStepper
        value={rounds}
        onChange={onRounds}
        min={MIN_ROUNDS}
        max={MAX_ROUNDS}
        label={t('offside.roundsPicker.label')}
      />
      <Button
        label={t('offside.local.start')}
        variant="primary"
        disabled={!ready}
        onPress={onStart}
      />
    </View>
  );
}

/**
 * One player's turn: the pass gate, then the four cards with THEIR draining
 * clock. Tapping a card submits with the online speed scoring; at zero the
 * turn turns in a blank. Submitting is the pass — the next gate comes up.
 */
function QuestionStage({
  state,
  onAdvance,
}: {
  state: LocalOffsideState;
  onAdvance: React.Dispatch<React.SetStateAction<LocalOffsideState | null>>;
}) {
  const {t} = useTranslation();
  const player = handoffPlayer(state);
  const round = state.deck[state.round - 1];
  const deadline = state.deadline;

  // At the deadline an unanswered turn turns in a blank. Functional update:
  // the engine's already-answered guard makes the tap-vs-timeout race safe,
  // and the per-turn key clears this timer the moment the turn resolves.
  useEffect(() => {
    if (deadline == null) {
      return;
    }
    const timer = setTimeout(() => {
      haptics.error();
      onAdvance(s => (s ? submitLocalAnswer(s, null) : s));
    }, Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [deadline, onAdvance]);

  if (!player || round == null) {
    return null;
  }
  return (
    <View style={styles.phase}>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('offside.round', {round: state.round, total: state.rounds})}
        </Text>
      </GlassTag>
      {!state.contentShown ? (
        <PassGate
          title={t('offside.local.passTo', {name: player.name})}
          sub={t('offside.local.questionIntro', {name: player.name})}
          actionLabel={t('offside.local.showCards')}
          onShow={() => onAdvance(s => (s ? revealQuestion(s) : s))}
        />
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
            selectedIndex={null}
            onPick={index => {
              haptics.press();
              onAdvance(s => (s ? submitLocalAnswer(s, index) : s));
            }}
          />
          <Text variant="secondary" color="secondary" align="center">
            {t('offside.question.hint')}
          </Text>
        </>
      )}
    </View>
  );
}

/** Phone in the middle: the odd one out and the hidden link, out in the open. */
function RevealStage({
  state,
  onAdvance,
}: {
  state: LocalOffsideState;
  onAdvance: () => void;
}) {
  const {t} = useTranslation();
  const round = state.deck[state.round - 1];
  if (round == null) {
    return null;
  }
  const explanation = explanationFor(round);
  return (
    <View style={styles.phase}>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('offside.round', {round: state.round, total: state.rounds})}
        </Text>
      </GlassTag>
      <Text variant="secondary" color="secondary" align="center">
        {t('offside.local.revealIntro')}
      </Text>
      <CardGrid
        cards={round.cards}
        selectedIndex={null}
        correctIndex={round.outlierIndex}
      />
      <Text variant="secondary" color="secondary" align="center">
        {t(explanation.key, explanation.params)}
      </Text>
      <Button
        label={t('offside.reveal.showScoreboard')}
        variant="primary"
        onPress={onAdvance}
      />
    </View>
  );
}

/** The Kahoot beat: the leaderboard alone on screen between rounds. */
function ScoreboardStage({
  state,
  onAdvance,
}: {
  state: LocalOffsideState;
  onAdvance: () => void;
}) {
  const {t} = useTranslation();
  const lastRound = state.round >= state.rounds;
  return (
    <View style={styles.phase}>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('offside.round', {round: state.round, total: state.rounds})}
        </Text>
      </GlassTag>
      <Text variant="section" align="center" style={styles.headline}>
        {t('offside.reveal.scoreboard')}
      </Text>
      <Scoreboard rows={standings(state)} deltas={deltasOf(state)} />
      <Button
        label={
          lastRound ? t('offside.reveal.toStandings') : t('offside.reveal.next')
        }
        variant="primary"
        onPress={onAdvance}
      />
    </View>
  );
}

/** Final board. Run it back with a fresh deck (scores reset) or head out. */
function StandingsStage({
  state,
  onPlayAgain,
  onExit,
}: {
  state: LocalOffsideState;
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const {t} = useTranslation();
  const board = standings(state);
  const winner = board[0];
  return (
    <View style={styles.phase}>
      {winner ? (
        <Text variant="wordmark" align="center" style={styles.headline}>
          {t('offside.standings.winner', {name: winner.name})}
        </Text>
      ) : null}
      <Scoreboard rows={board} deltas={{}} />
      <View style={styles.resultActions}>
        <Button
          label={t('offside.playAgain')}
          variant="primary"
          onPress={onPlayAgain}
        />
        <Button
          label={t('offside.local.exit')}
          variant="secondary"
          onPress={onExit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  // Centres the active stage below the header; tall boards top-align.
  phaseWrap: {flex: 1, justifyContent: 'center'},
  phaseWrapTop: {justifyContent: 'flex-start'},
  phase: {gap: spacing.lg, alignItems: 'stretch'},
  headline: {color: colors.ink},
  topicText: {letterSpacing: 1, marginTop: -spacing.sm},
  // Quiet glass round pill, shared with the online screen's look.
  roundPill: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  roundText: {letterSpacing: 1},
  resultActions: {gap: spacing.md, marginTop: spacing.sm},
});
