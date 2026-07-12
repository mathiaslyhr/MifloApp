import React, {useEffect, useRef, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
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
  Skeleton,
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
import {
  playMove,
  recordGameResults,
  restartCultHeroGame,
  returnToLobby,
  submitCultHeroAnswer,
  subscribeRoom,
} from '../core/rooms/roomService';
import {entriesFromStandings, matchIdFrom} from '../core/stats/recordEntries';
import {
  createConnectionNotifier,
  notifyPartyClosed,
} from '../core/rooms/connectionStatus';
import {ensureSession} from '../core/supabase/client';
import {FootballerSearchModal} from '../games/shared/FootballerSearchModal';
import {Scoreboard} from '../games/offside/components';
import {
  PickedAnswerCard,
  PromptBlock,
  ResultRevealCard,
} from '../games/cult-hero/components';
import {advanceRoundReveal, nameOf, standings} from '../games/cult-hero/engine';
import {buildPromptPayloads} from '../games/cult-hero/famePrior';
import {
  notePrompts,
  promptText,
  takeSessionPrompts,
} from '../games/cult-hero/prompts';
import type {CultHeroState} from '../games/cult-hero/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CultHero'>;

export function CultHeroScreen({route, navigation}: Props) {
  const {roomId} = route.params;
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [state, setState] = useState<CultHeroState | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const insets = useSafeAreaInsets();
  const leftRef = useRef(false);

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
        setState(room.gameState as CultHeroState);
      },
      // Host left the party entirely (no host, no party) → back to the menu.
      ({selfIsHost}) => {
        if (!leftRef.current) {
          leftRef.current = true;
          notifyPartyClosed(selfIsHost);
          navigation.popToTop();
        }
      },
      createConnectionNotifier(),
    );
    return unsub;
  }, [roomId, navigation]);

  const isHost = !!myUserId && myUserId === hostId;

  // Host records the final result once the game reaches the 'final' phase
  // (0031). Keyed by the game's prompts so a Play again (fresh prompts, same
  // room) records as a distinct game; the ref stops it re-firing every render.
  const recordedMatchRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'final') {
      return;
    }
    const matchId = matchIdFrom(roomId, state.promptKeys.join('|'));
    if (recordedMatchRef.current === matchId) {
      return;
    }
    recordedMatchRef.current = matchId;
    recordGameResults(
      matchId,
      roomId,
      entriesFromStandings(standings(state)),
      'cult-hero',
    ).catch(() => {});
  }, [isHost, state, roomId]);

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
        <View style={styles.loading} accessibilityLabel={t('cultHero.loading')}>
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
              accessibilityLabel={t('cultHero.backToLobby')}
              onPress={handleBack}>
              <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
            </CircleButton>
          </View>
        </FloatingBar>
        <TopStatusFade />
      </Screen>
    );
  }

  // Host pages the one-by-one result reveal; the server put the turn on the
  // host when the round resolved, so play_move only accepts the host here.
  function advanceReveal() {
    if (!state) {
      return;
    }
    haptics.press();
    playMove(roomId, advanceRoundReveal(state)).catch(notifyNetworkError);
  }

  async function playAgain() {
    if (!state) {
      return;
    }
    try {
      // Make sure the current game is in the party's prompt history even if
      // the app restarted mid-session, then deal prompts it hasn't seen yet.
      notePrompts(roomId, state.promptKeys);
      await restartCultHeroGame(
        roomId,
        state.rounds,
        buildPromptPayloads(takeSessionPrompts(roomId, state.rounds)),
      );
    } catch {
      toast.error(t('cultHero.newGameError'));
    }
  }

  return (
    // Drop the top safe-area edge — the scroll content owns the top inset so the
    // wordmark scrolls away; back/help stay pinned as floating corner buttons.
    <Screen canvas edges={['left', 'right', 'bottom']}>
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

        {/* Short phases centre in the space below the header; the tall final
            standings top-align so they scroll normally. */}
        <View
          style={[
            styles.phaseWrap,
            state.phase === 'final' && styles.phaseWrapTop,
          ]}>
          {state.phase === 'answering' ? (
            // Keyed per round so the pick and submitted flag reset with each
            // new prompt.
            <AnsweringPhase
              key={state.round}
              state={state}
              onSubmit={footballerId =>
                submitCultHeroAnswer(roomId, footballerId)
              }
            />
          ) : state.phase === 'roundReveal' ? (
            <RoundRevealPhase
              state={state}
              isHost={isHost}
              onAdvance={advanceReveal}
            />
          ) : state.phase === 'leaderboard' ? (
            <LeaderboardPhase
              state={state}
              isHost={isHost}
              onAdvance={advanceReveal}
            />
          ) : (
            <FinalPhase
              state={state}
              isHost={isHost}
              onPlayAgain={playAgain}
              onBackToLobby={() =>
                returnToLobby(roomId).catch(notifyNetworkError)
              }
            />
          )}
        </View>
      </ScrollView>

      {/* Pinned floating corner buttons (back left, help right) — stay put while
          the wordmark scrolls away. */}
      <FloatingBar edge="top" style={styles.chromeBar}>
        <View style={styles.chromeRow}>
          <CircleButton
            size={36}
            accessibilityLabel={t('cultHero.backToLobby')}
            onPress={handleBack}>
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

/**
 * The whole table gets the same prompt; each device secretly picks one
 * footballer through the shared search. The pick can be changed until the
 * server resolves the round (a resubmit just replaces it).
 */
function AnsweringPhase({
  state,
  onSubmit,
}: {
  state: CultHeroState;
  onSubmit: (footballerId: string) => Promise<void>;
}) {
  const {t, i18n} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [searchOpen, setSearchOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  function submit(footballerId: string) {
    setSearchOpen(false);
    const previous = picked;
    setPicked(footballerId);
    haptics.press();
    onSubmit(footballerId).catch(() => {
      setPicked(previous);
      haptics.error();
      toast.error(t('cultHero.errorAnswer'));
    });
  }

  const prompt = promptText(
    state.promptKeys[state.round - 1],
    t,
    i18n.language,
  );
  // Who's holding the round up (yourself included until the server counts you).
  const remaining = Math.max(state.players.length - state.answeredCount, 1);

  return (
    <View style={styles.phase}>
      <PromptBlock round={state.round} total={state.rounds} text={prompt} />

      {picked ? (
        <>
          <PickedAnswerCard footballerId={picked} />
          <Text variant="secondary" color="secondary" align="center">
            {remaining === 1
              ? t('cultHero.answer.waitingOne')
              : t('cultHero.answer.waitingMany', {count: remaining})}
          </Text>
          <Button
            label={t('cultHero.answer.change')}
            variant="secondary"
            onPress={() => setSearchOpen(true)}
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
            onPress={() => setSearchOpen(true)}
          />
        </>
      )}

      <FootballerSearchModal
        visible={searchOpen}
        title={prompt}
        titleVariant="section"
        placeholder={t('cultHero.searchPlaceholder')}
        hint={t('cultHero.searchHint')}
        empty={t('cultHero.noPlayers')}
        onPick={submit}
        onClose={() => setSearchOpen(false)}
      />
    </View>
  );
}

/**
 * The round's scored answers, one by one from the most common up to the
 * rarest. The host reads them out and pages through; after the last one the
 * button rolls into the next prompt or the final standings.
 */
function RoundRevealPhase({
  state,
  isHost,
  onAdvance,
}: {
  state: CultHeroState;
  isHost: boolean;
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
      <ResultRevealCard
        name={nameOf(state, result.userId)}
        result={result}
        index={state.revealIndex}
        total={results.length}
      />
      {isHost ? (
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
 * Kahoot beat between questions: the running standings with this round's
 * points, host moves the table on to the next question. The last round skips
 * this (the final standings ARE the leaderboard).
 */
function LeaderboardPhase({
  state,
  isHost,
  onAdvance,
}: {
  state: CultHeroState;
  isHost: boolean;
  onAdvance: () => void;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const board = standings(state);
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
      <Scoreboard rows={board} deltas={deltas} />
      {isHost ? (
        <Button
          label={t('cultHero.results.nextRound')}
          variant="primary"
          onPress={onAdvance}
        />
      ) : (
        <Text variant="secondary" color="secondary" align="center">
          {t('cultHero.waitingHost')}
        </Text>
      )}
    </View>
  );
}

function FinalPhase({
  state,
  isHost,
  onPlayAgain,
  onBackToLobby,
}: {
  state: CultHeroState;
  isHost: boolean;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
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

      {isHost ? (
        <View style={styles.resultActions}>
          <Button
            label={t('cultHero.playAgain')}
            variant="primary"
            onPress={onPlayAgain}
          />
          <Button
            label={t('cultHero.backToLobby')}
            variant="secondary"
            onPress={onBackToLobby}
          />
        </View>
      ) : (
        <Text
          variant="secondary"
          color="secondary"
          align="center"
          style={styles.waiting}>
          {t('cultHero.waitingHost')}
        </Text>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  loadingStack: {width: '100%', gap: 12},
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
  // Centres the active phase in the space between the header and the bottom.
  phaseWrap: {flex: 1, justifyContent: 'center'},
  phaseWrapTop: {justifyContent: 'flex-start'},
  phase: {gap: spacing.lg, alignItems: 'stretch'},
  headline: {color: c.ink},
  resultActions: {gap: spacing.md, marginTop: spacing.sm},
  waiting: {marginTop: spacing.md},
  });
