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
  HowToPlayModal,
  Screen,
  Text,
  toast,
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
import {useSearch} from '../games/shared/SearchScreen';
import {playerSource} from '../games/shared/searchSources';
import {
  LOCAL_MAX_PLAYERS,
  PassGate,
  PlayerNamesEditor,
} from '../games/shared/localPlay';
import {Scoreboard} from '../games/offside/components';
import {RoundsStepper} from '../games/shared/RoundsStepper';
import {
  PickedAnswerCard,
  PromptBlock,
  ResultRevealCard,
} from '../games/cult-hero/components';
import {nameOf, standings} from '../games/cult-hero/engine';
import {promptText} from '../games/cult-hero/prompts';
import {
  advanceLocalReveal,
  createLocalCultHeroGame,
  createLocalCultHeroRematch,
  handoffPlayer,
  LOCAL_MIN_PLAYERS,
  showPick,
  submitLocalPick,
} from '../games/cult-hero/localEngine';
import {
  DEFAULT_ROUNDS,
  MAX_ROUNDS,
  MIN_ROUNDS,
} from '../games/cult-hero/types';
import type {LocalCultHeroState} from '../games/cult-hero/localEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'CultHeroLocal'>;

/**
 * Pass-and-play Cult Hero — the rarest-answer game on one shared phone, fully
 * offline. The handoff gate keeps each pick secret; a lock-in replaces the
 * online resubmit window (after the pass, the pick is final). Rarity is scored
 * by the fame prior alone — no global stats offline, by design — then the
 * phone goes in the middle and anyone pages the reveal from the most obvious
 * pick up to the rarest.
 */
export function CultHeroLocalScreen({navigation}: Props) {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [state, setState] = useState<LocalCultHeroState | null>(null);
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
      setState(createLocalCultHeroGame(names, rounds));
    } catch {
      toast.error(t('cultHero.newGameError'));
    }
  }

  function playAgain() {
    haptics.press();
    try {
      setState(s => (s ? createLocalCultHeroRematch(s) : s));
    } catch {
      toast.error(t('cultHero.newGameError'));
    }
  }

  function advance() {
    haptics.press();
    setState(s => (s ? advanceLocalReveal(s) : s));
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
              {t('cultHero.title')}
            </Text>
          </View>

          {/* Short stages centre below the header; the tall final top-aligns. */}
          <View
            style={[
              styles.phaseWrap,
              state?.phase === 'final' && styles.phaseWrapTop,
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
            ) : state.phase === 'answering' ? (
              // Keyed per player-and-round so a draft pick never leaks to the
              // next person the phone is passed to.
              <AnsweringStage
                key={`${state.round}:${state.handoffIndex}`}
                state={state}
                onAdvance={setState}
              />
            ) : state.phase === 'roundReveal' ? (
              <RoundRevealStage state={state} onAdvance={advance} />
            ) : state.phase === 'leaderboard' ? (
              <LeaderboardStage state={state} onAdvance={advance} />
            ) : (
              <FinalStage
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
            accessibilityLabel={t('cultHero.local.exit')}
            onPress={() => navigation.goBack()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
          <View style={styles.chromeSpacer} />
          <CircleButton
            size={36}
            accessibilityLabel={t('cultHero.help.title')}
            onPress={() => setShowHelp(true)}>
            <HelpCircle size={18} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        </View>
      </FloatingBar>
      <TopStatusFade />

      <HowToPlayModal
        visible={showHelp}
        onClose={() => setShowHelp(false)}
        title={t('cultHero.help.title')}
        lines={[{text: t('cultHero.help.rule')}]}
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
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.phase}>
      <Text variant="section" align="center" style={styles.headline}>
        {t('cultHero.local.setupTitle')}
      </Text>
      <Text variant="secondary" color="secondary" align="center">
        {t('cultHero.local.setupSub', {count: LOCAL_MIN_PLAYERS})}
      </Text>
      <PlayerNamesEditor
        names={names}
        onChange={onChange}
        minPlayers={LOCAL_MIN_PLAYERS}
        maxPlayers={LOCAL_MAX_PLAYERS}
        placeholder={t('cultHero.local.namePlaceholder')}
        addLabel={t('cultHero.local.addPlayer')}
        removeLabel={t('cultHero.local.removePlayer')}
      />
      <RoundsStepper
        value={rounds}
        onChange={onRounds}
        min={MIN_ROUNDS}
        max={MAX_ROUNDS}
        label={t('cultHero.roundsPicker.label')}
      />
      <Button
        label={t('cultHero.local.start')}
        variant="primary"
        disabled={!ready}
        onPress={onStart}
      />
    </View>
  );
}

/**
 * One player's secret pick: the prompt is public above the gate, the pick UI
 * comes up only for the gated player. A draft can still be changed; locking in
 * passes the phone, and after that the pick is final.
 */
function AnsweringStage({
  state,
  onAdvance,
}: {
  state: LocalCultHeroState;
  onAdvance: React.Dispatch<React.SetStateAction<LocalCultHeroState | null>>;
}) {
  const {t, i18n} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const openSearch = useSearch();
  const [draft, setDraft] = useState<string | null>(null);
  const player = handoffPlayer(state);
  if (!player) {
    return null;
  }
  const prompt = promptText(state.promptKeys[state.round - 1], t, i18n.language);

  function openPicker() {
    openSearch(playerSource(), {
      title: prompt,
      placeholder: t('cultHero.searchPlaceholder'),
      emptyHint: t('cultHero.searchHint'),
      noMatch: t('cultHero.noPlayers'),
    }).then(item => {
      if (item) {
        haptics.press();
        setDraft(item.id);
      }
    });
  }

  function lockIn() {
    if (!draft) {
      return;
    }
    haptics.press();
    const pick = draft;
    onAdvance(s => (s ? submitLocalPick(s, pick) : s));
  }

  return (
    <View style={styles.phase}>
      <PromptBlock round={state.round} total={state.rounds} text={prompt} />

      {!state.contentShown ? (
        <PassGate
          title={t('cultHero.local.passTo', {name: player.name})}
          sub={t('cultHero.local.pickIntro', {name: player.name})}
          actionLabel={t('cultHero.local.showPick')}
          onShow={() => onAdvance(s => (s ? showPick(s) : s))}
        />
      ) : draft ? (
        <>
          <PickedAnswerCard footballerId={draft} />
          <Button
            label={t('cultHero.answer.change')}
            variant="secondary"
            onPress={openPicker}
          />
          <Button
            label={t('cultHero.local.lockIn')}
            variant="primary"
            onPress={lockIn}
          />
        </>
      ) : (
        <>
          <Text variant="secondary" color="secondary" align="center">
            {t('cultHero.answer.hint')}
          </Text>
          <Button
            label={t('cultHero.answer.pick')}
            variant="primary"
            onPress={openPicker}
          />
        </>
      )}

    </View>
  );
}

/**
 * Phone in the middle: the round's scored answers one by one, from the most
 * obvious pick up to the rarest. Anyone pages; after the last one the button
 * rolls into the leaderboard or the final standings.
 */
function RoundRevealStage({
  state,
  onAdvance,
}: {
  state: LocalCultHeroState;
  onAdvance: () => void;
}) {
  const {t, i18n} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const results = state.results ?? [];
  const result = results[state.revealIndex];
  if (!result) {
    return null;
  }
  const isLastResult = state.revealIndex >= results.length - 1;
  const label = !isLastResult
    ? t('cultHero.results.next')
    : state.round < state.rounds
    ? t('cultHero.results.toLeaderboard')
    : t('cultHero.results.toFinal');
  return (
    <View style={styles.phase}>
      <PromptBlock
        round={state.round}
        total={state.rounds}
        text={promptText(state.promptKeys[state.round - 1], t, i18n.language)}
        muted
      />
      <Text variant="secondary" color="secondary" align="center">
        {t('cultHero.local.revealIntro')}
      </Text>
      <ResultRevealCard
        name={nameOf(state, result.userId)}
        result={result}
        index={state.revealIndex}
        total={results.length}
      />
      <Button label={label} variant="primary" onPress={onAdvance} />
    </View>
  );
}

/** Kahoot beat between prompts: the running standings with this round's points. */
function LeaderboardStage({
  state,
  onAdvance,
}: {
  state: LocalCultHeroState;
  onAdvance: () => void;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const deltas: Record<string, number> = {};
  for (const result of state.results ?? []) {
    deltas[result.userId] = result.score;
  }
  return (
    <View style={styles.phase}>
      <PromptBlock
        round={state.round}
        total={state.rounds}
        text={t('cultHero.leaderboard.title')}
      />
      <Scoreboard rows={standings(state)} deltas={deltas} />
      <Button
        label={t('cultHero.results.nextRound')}
        variant="primary"
        onPress={onAdvance}
      />
    </View>
  );
}

/** Final board. Run it back (scores carry forward, like online) or head out. */
function FinalStage({
  state,
  onPlayAgain,
  onExit,
}: {
  state: LocalCultHeroState;
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const board = standings(state);
  // The last round's scores double as the final deltas.
  const deltas: Record<string, number> = {};
  for (const result of state.results ?? []) {
    deltas[result.userId] = result.score;
  }
  return (
    <View style={styles.phase}>
      {board.length > 0 ? (
        <Text variant="wordmark" align="center" style={styles.headline}>
          {t('cultHero.final.winner', {name: board[0].name})}
        </Text>
      ) : null}
      <Scoreboard rows={board} deltas={deltas} />
      <View style={styles.resultActions}>
        <Button
          label={t('cultHero.playAgain')}
          variant="primary"
          onPress={onPlayAgain}
        />
        <Button
          label={t('cultHero.local.exit')}
          variant="secondary"
          onPress={onExit}
        />
      </View>
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
  // Centres the active stage below the header; the tall final top-aligns.
  phaseWrap: {flex: 1, justifyContent: 'center'},
  phaseWrapTop: {justifyContent: 'flex-start'},
  phase: {gap: spacing.lg, alignItems: 'stretch'},
  headline: {color: c.ink},
  resultActions: {gap: spacing.md, marginTop: spacing.sm},
  });
