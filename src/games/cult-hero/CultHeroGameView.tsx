/**
 * Cult Hero's screen, for both ways of playing it.
 *
 * Online and pass-and-play render the SAME game: same phases, same board, same
 * scoring. One shared phone only adds steps — a "pass the phone" gate in front
 * of each secret pick, and a lock-in where online lets you resubmit. Everything
 * else here is written once.
 *
 * The split:
 * - `state` is the broadcast-safe public state.
 * - `perspective` is everything one pair of eyes may privately see.
 *
 * Containers own state and transport (online: `subscribeRoom` + RPCs; local:
 * `useState` + the pure engine). This view owns presentation and gating.
 */
import React, {useState} from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Button, Skeleton, Text, toast} from '../../core/ui';
import {haptics} from '../../core/haptics';
import {spacing} from '../../theme';
import {GameShell, phaseStyles} from '../shared/GameShell';
import {PassGate, type PassGateSpec} from '../shared/localPlay';
import {useSearch} from '../shared/SearchScreen';
import {playerSource} from '../shared/searchSources';
import {Scoreboard} from '../offside/components';
import {PickedAnswerCard, PromptBlock, ResultRevealCard} from './components';
import {deltasOf, nameOf, standings} from './engine';
import {promptText} from './prompts';
import type {CultHeroState} from './types';

/**
 * Who is looking at the screen.
 * - `online`: one device per player — the whole table answers at once, so the
 *   view can say who it's still waiting on.
 * - `local`: one shared phone — the actor is whoever the phone was passed to,
 *   and they play the exact part `myUserId` plays online.
 */
export type CultHeroPerspective =
  | {kind: 'online'; myUserId: string | null}
  | {
      kind: 'local';
      actorUserId: string;
      /** 1-based place in the handoff round-trip. */
      handoff: {index: number; total: number};
    };

type Props = {
  /** Null while an online room primes over realtime, or before local setup deals. */
  state: CultHeroState | null;
  perspective: CultHeroPerspective;
  /** Non-null ⇒ render the gate instead of the phase body, keeping its chrome. */
  gate: PassGateSpec | null;
  onShowContent: () => void;
  /**
   * The actor's pick. Online: `submit_cult_hero_answer`. Local:
   * `submitLocalPick`. Async so the view can roll a failed pick back.
   */
  onSubmitPick: (footballerId: string) => Promise<void>;
  /**
   * true ⇒ the pick needs an explicit "Lock in" and is final after (local: the
   * phone moves on). false ⇒ picking submits straight away and "Change"
   * resubmits (online: the server takes the last write until the round resolves).
   */
  pickIsFinal: boolean;
  /** roundReveal → leaderboard → next / final. */
  onAdvance: () => void;
  onPlayAgain: () => void;
  onExit: () => void;
  /** The final's secondary action, and the back circle's label. */
  exitLabel: string;
  onBack: () => void;
  /** The final shows Play again + exit (online host; always local). */
  showResultActions: boolean;
  /** The reveal/leaderboard pagers are tappable (online host; always local). */
  canAdvance: boolean;
  /** Local only: rendered while `state` is null. Online omits it for a skeleton. */
  setupSlot?: React.ReactNode;
};

export function CultHeroGameView({
  state,
  perspective,
  gate,
  onShowContent,
  onSubmitPick,
  pickIsFinal,
  onAdvance,
  onPlayAgain,
  onExit,
  exitLabel,
  onBack,
  showResultActions,
  canAdvance,
  setupSlot,
}: Props) {
  const {t} = useTranslation();
  const help = {
    title: t('cultHero.help.title'),
    lines: [{text: t('cultHero.help.rule')}],
  };

  // The tall final standings top-align and scroll; short phases centre.
  const topAlign = state?.phase === 'final';

  return (
    <GameShell
      title={t('cultHero.title')}
      backLabel={exitLabel}
      onBack={onBack}
      help={help}
      topAlign={topAlign}>
      {state === null ? (
        setupSlot ?? <PrimingSkeleton />
      ) : state.phase === 'answering' ? (
        // Keyed per round online so the pick resets with each new prompt, and
        // per player-and-round locally so a draft never leaks to the next pair
        // of eyes. Not keyed on myUserId: it starts null and resolving it would
        // remount and wipe a half-made pick.
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
          onSubmitPick={onSubmitPick}
          pickIsFinal={pickIsFinal}
        />
      ) : state.phase === 'roundReveal' ? (
        <RoundRevealPhase
          state={state}
          perspective={perspective}
          canAdvance={canAdvance}
          onAdvance={onAdvance}
        />
      ) : state.phase === 'leaderboard' ? (
        <LeaderboardPhase
          state={state}
          canAdvance={canAdvance}
          onAdvance={onAdvance}
        />
      ) : (
        <FinalPhase
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
    <View style={phaseStyles.phase} accessibilityLabel={t('cultHero.loading')}>
      <Skeleton width="60%" height={22} />
      <Skeleton width="100%" height={120} />
      <Skeleton width="100%" height={52} />
      <Skeleton width="100%" height={52} />
    </View>
  );
}

/**
 * One secret pick against the round's prompt. Online the whole table picks at
 * once and can change until the server resolves; locally the gated player picks
 * alone, and locking in both submits and passes the phone.
 */
function AnsweringPhase({
  state,
  perspective,
  gate,
  onShowContent,
  onSubmitPick,
  pickIsFinal,
}: {
  state: CultHeroState;
  perspective: CultHeroPerspective;
  gate: PassGateSpec | null;
  onShowContent: () => void;
  onSubmitPick: (footballerId: string) => Promise<void>;
  pickIsFinal: boolean;
}) {
  const {t, i18n} = useTranslation();
  const openSearch = useSearch();
  const [pick, setPick] = useState<string | null>(null);

  const prompt = promptText(state.promptKeys[state.round - 1], t, i18n.language);

  function fail(previous: string | null) {
    setPick(previous);
    haptics.error();
    toast.error(t('cultHero.errorAnswer'));
  }

  function openPicker() {
    openSearch(playerSource(), {
      title: prompt,
      placeholder: t('cultHero.searchPlaceholder'),
      emptyHint: t('cultHero.searchHint'),
      noMatch: t('cultHero.noPlayers'),
    }).then(item => {
      if (!item) {
        return;
      }
      haptics.press();
      if (pickIsFinal) {
        // A draft — nothing is committed until "Lock in".
        setPick(item.id);
        return;
      }
      const previous = pick;
      setPick(item.id);
      onSubmitPick(item.id).catch(() => fail(previous));
    });
  }

  function lockIn() {
    if (!pick) {
      return;
    }
    haptics.press();
    onSubmitPick(pick).catch(() => fail(pick));
  }

  // Who's holding the round up (yourself included until the server counts you).
  const remaining = Math.max(state.players.length - state.answeredCount, 1);

  return (
    <View style={phaseStyles.phase}>
      <PromptBlock round={state.round} total={state.rounds} text={prompt} />

      {gate ? (
        <PassGate spec={gate} onShow={onShowContent} />
      ) : pick ? (
        <>
          <PickedAnswerCard footballerId={pick} />
          {/* Only online is there a table to wait on: locally, locking in IS
              the pass, so there is nobody left to count. */}
          {perspective.kind === 'online' ? (
            <Text variant="secondary" color="secondary" align="center">
              {remaining === 1
                ? t('cultHero.answer.waitingOne')
                : t('cultHero.answer.waitingMany', {count: remaining})}
            </Text>
          ) : null}
          <Button
            label={t('cultHero.answer.change')}
            variant="secondary"
            onPress={openPicker}
          />
          {pickIsFinal ? (
            <Button
              label={t('cultHero.local.lockIn')}
              variant="primary"
              onPress={lockIn}
            />
          ) : null}
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
 * The round's scored answers one by one, from the most obvious pick up to the
 * rarest. Online the host reads them out and pages; locally the phone goes in
 * the middle and anyone pages.
 */
function RoundRevealPhase({
  state,
  perspective,
  canAdvance,
  onAdvance,
}: {
  state: CultHeroState;
  perspective: CultHeroPerspective;
  canAdvance: boolean;
  onAdvance: () => void;
}) {
  const {t, i18n} = useTranslation();
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
    <View style={phaseStyles.phase}>
      <PromptBlock
        round={state.round}
        total={state.rounds}
        text={promptText(state.promptKeys[state.round - 1], t, i18n.language)}
        muted
      />
      {perspective.kind === 'local' ? (
        <Text variant="secondary" color="secondary" align="center">
          {t('cultHero.local.revealIntro')}
        </Text>
      ) : null}
      <ResultRevealCard
        name={nameOf(state, result.userId)}
        result={result}
        index={state.revealIndex}
        total={results.length}
      />
      {canAdvance ? (
        <Button label={label} variant="primary" onPress={onAdvance} />
      ) : (
        <Text variant="secondary" color="secondary" align="center">
          {t('cultHero.results.hostAdvances')}
        </Text>
      )}
    </View>
  );
}

/**
 * Kahoot beat between prompts: the running standings with this round's points.
 * The last round skips it — the final standings ARE the leaderboard.
 */
function LeaderboardPhase({
  state,
  canAdvance,
  onAdvance,
}: {
  state: CultHeroState;
  canAdvance: boolean;
  onAdvance: () => void;
}) {
  const {t} = useTranslation();
  return (
    <View style={phaseStyles.phase}>
      <PromptBlock
        round={state.round}
        total={state.rounds}
        text={t('cultHero.leaderboard.title')}
      />
      <Scoreboard rows={standings(state)} deltas={deltasOf(state)} />
      {canAdvance ? (
        <Button
          label={t('cultHero.results.nextRound')}
          variant="primary"
          onPress={onAdvance}
        />
      ) : (
        <Text variant="secondary" color="secondary" align="center">
          {t('cultHero.results.hostAdvances')}
        </Text>
      )}
    </View>
  );
}

/** Final board. Run it back (scores carry forward) or head out. */
function FinalPhase({
  state,
  showResultActions,
  onPlayAgain,
  onExit,
  exitLabel,
}: {
  state: CultHeroState;
  showResultActions: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
  exitLabel: string;
}) {
  const {t} = useTranslation();
  const board = standings(state);
  return (
    <View style={phaseStyles.phase}>
      {board.length > 0 ? (
        <Text variant="wordmark" align="center">
          {t('cultHero.final.winner', {name: board[0].name})}
        </Text>
      ) : null}

      <Scoreboard rows={board} deltas={deltasOf(state)} />

      {showResultActions ? (
        <View style={phaseStyles.resultActions}>
          <Button
            label={t('cultHero.playAgain')}
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
          style={{marginTop: spacing.md}}>
          {t('cultHero.waitingHost')}
        </Text>
      )}
    </View>
  );
}
