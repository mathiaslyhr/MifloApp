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
  GlassTag,
  HowToPlayModal,
  Screen,
  Skeleton,
  Text,
  toast,
  TopStatusFade,
} from '../core/ui';
import {haptics} from '../core/haptics';
import {colors, screenPadding, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {
  advanceOffsideRound,
  forceOffsideReveal,
  restartOffsideGame,
  returnToLobby,
  submitOffsideAnswer,
  subscribeRoom,
} from '../core/rooms/roomService';
import {
  createConnectionNotifier,
  notifyPartyClosed,
} from '../core/rooms/connectionStatus';
import {ensureSession} from '../core/supabase/client';
import {CardGrid, CountdownBar, Scoreboard} from '../games/offside/components';
import {
  deadlineTs,
  deltasOf,
  explanationFor,
  hasAnswered,
  missingNames,
  standings,
  topicKeyFor,
} from '../games/offside/engine';
import {fractionRemaining, scoreAnswer} from '../games/offside/scoring';
import {buildRounds} from '../games/offside/questions';
import {
  FORCE_REVEAL_GRACE_MS,
  QUESTION_DURATION_MS,
} from '../games/offside/types';
import type {OffsideState} from '../games/offside/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Offside'>;

/**
 * Offside — the online odd-one-out race. The broadcast room state is the single
 * source of truth (deck, phase, answers, scores); this screen renders it and
 * pushes the player's own actions through the 0017 RPCs. Rejoining mid-game
 * therefore lands exactly where the room is.
 */
export function OffsideScreen({route, navigation}: Props) {
  const {roomId} = route.params;
  const {t} = useTranslation();
  const [state, setState] = useState<OffsideState | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
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
        setState(room.gameState as OffsideState);
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
  const deadline = state ? deadlineTs(state) : null;

  // Entering a reveal: buzz by how your own round went.
  useEffect(() => {
    if (!state || !myUserId) {
      return;
    }
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;
    if (prev === 'question' && state.phase === 'reveal') {
      const mine = state.answers[myUserId];
      const round = state.deck[state.round - 1];
      if (mine?.option != null && mine.option === round?.outlierIndex) {
        haptics.success();
      } else {
        haptics.error();
      }
    }
  }, [state, myUserId]);

  // Host safety net: once the deadline (plus grace) passes with the question
  // still open, force the reveal so a leaver/backgrounded player can't stall
  // the round. The server rejects premature calls and no-ops resolved ones.
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'question' || deadline == null) {
      return;
    }
    const wait = Math.max(0, deadline + FORCE_REVEAL_GRACE_MS - Date.now());
    const timer = setTimeout(() => {
      forceOffsideReveal(roomId).catch(() => {});
    }, wait);
    return () => clearTimeout(timer);
  }, [isHost, state, deadline, roomId]);

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

  function advance() {
    haptics.press();
    advanceOffsideRound(roomId).catch(notifyNetworkError);
  }

  async function playAgain() {
    if (!state) {
      return;
    }
    try {
      const deck = buildRounds(state.rounds);
      if (deck.length === 0) {
        throw new Error('Offside deck came back empty');
      }
      await restartOffsideGame(roomId, deck, deck.length);
    } catch {
      toast.error(t('offside.newGameError'));
    }
  }

  if (!state) {
    return (
      <Screen canvas edges={['left', 'right', 'bottom']}>
        {/* Ghost round layout while the room state primes over realtime. */}
        <View style={styles.loading} accessibilityLabel={t('offside.loading')}>
          <View style={styles.loadingStack}>
            <Skeleton width="60%" height={22} />
            <Skeleton width="100%" height={4} radius={2} />
            <Skeleton width="100%" height={92} />
            <Skeleton width="100%" height={92} />
          </View>
        </View>
        <FloatingBar edge="top" style={styles.chromeBar}>
          <View style={styles.chromeRow}>
            <CircleButton
              size={36}
              accessibilityLabel={t('offside.backToLobby')}
              onPress={handleBack}>
              <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
            </CircleButton>
          </View>
        </FloatingBar>
        <TopStatusFade />
      </Screen>
    );
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
        showsVerticalScrollIndicator={false}>
        {/* Wordmark header — in the scroll flow, so it scrolls off the top. */}
        <View style={styles.titleHeader}>
          <Text variant="wordmark" align="center">
            {t('offside.title')}
          </Text>
        </View>

        {/* The question centres in the space below the header; the taller
            reveal/standings top-align so they scroll normally. */}
        <View
          style={[
            styles.phaseWrap,
            state.phase !== 'question' && styles.phaseWrapTop,
          ]}>
          {state.phase === 'question' ? (
            // Keyed per round so the local pick + timeout reset each question.
            <QuestionPhase
              key={state.round}
              state={state}
              myUserId={myUserId}
              deadline={deadline}
              onSubmit={(option, points) =>
                submitOffsideAnswer(roomId, state.round, option, points)
              }
            />
          ) : state.phase === 'reveal' ? (
            <RevealPhase
              state={state}
              myUserId={myUserId}
              isHost={isHost}
              onAdvance={advance}
            />
          ) : state.phase === 'scoreboard' ? (
            <ScoreboardPhase state={state} isHost={isHost} onAdvance={advance} />
          ) : (
            <StandingsPhase
              state={state}
              isHost={isHost}
              onPlayAgain={playAgain}
              onBackToLobby={() => returnToLobby(roomId).catch(notifyNetworkError)}
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
            accessibilityLabel={t('offside.backToLobby')}
            onPress={handleBack}>
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
          {text: t('offside.help.rule2')},
          {text: t('offside.help.rule3')},
        ]}
      />
    </Screen>
  );
}

/**
 * One question: four cards, a draining clock, one tap. The pick locks in
 * optimistically (rolled back if the RPC fails) and scores itself from the
 * shared server deadline; at zero an unanswered device submits a blank so the
 * round can resolve without the host's force fallback.
 */
function QuestionPhase({
  state,
  myUserId,
  deadline,
  onSubmit,
}: {
  state: OffsideState;
  myUserId: string | null;
  deadline: number | null;
  onSubmit: (option: number | null, points: number) => Promise<void>;
}) {
  const {t} = useTranslation();
  const [localPick, setLocalPick] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const round = state.deck[state.round - 1];
  const missing = missingNames(state);
  const submitted = (!!myUserId && hasAnswered(state, myUserId)) || localPick != null;
  // What answered means for the reveal-mode grid: my confirmed pick, or the
  // optimistic one while the submit is in flight.
  const myOption =
    myUserId != null ? state.answers[myUserId]?.option ?? localPick : localPick;

  function pick(index: number) {
    if (submitted || round == null || deadline == null) {
      return;
    }
    haptics.press();
    const fraction = fractionRemaining(deadline, Date.now());
    const points = scoreAnswer(index === round.outlierIndex, fraction);
    setLocalPick(index);
    onSubmit(index, points).catch(() => {
      setLocalPick(null);
      haptics.error();
      toast.error(t('offside.errorAnswer'));
    });
  }

  // At the deadline an unanswered device turns in a blank (0 points). The
  // server ignores it if the round already resolved.
  useEffect(() => {
    if (deadline == null) {
      return;
    }
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [deadline]);
  useEffect(() => {
    if (timedOut && !submitted) {
      setLocalPick(-1); // sentinel: no tappable card matches, grid stays locked
      onSubmit(null, 0).catch(() => {});
    }
    // Intentionally not re-armed by `submitted`: once is enough, dupes are
    // ignored server-side anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOut]);

  if (round == null) {
    return null;
  }
  return (
    <View style={styles.phase}>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('offside.round', {round: state.round, total: state.rounds})}
        </Text>
      </GlassTag>
      <Text variant="section" align="center" style={styles.headline}>
        {t('offside.question.prompt')}
      </Text>
      <Text variant="caption" color="muted" align="center" style={styles.topicText}>
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
      {submitted ? (
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

/** The answer and the hidden link; the leaderboard follows as its own beat. */
function RevealPhase({
  state,
  myUserId,
  isHost,
  onAdvance,
}: {
  state: OffsideState;
  myUserId: string | null;
  isHost: boolean;
  onAdvance: () => void;
}) {
  const {t} = useTranslation();
  const round = state.deck[state.round - 1];
  if (round == null) {
    return null;
  }
  const mine = myUserId != null ? state.answers[myUserId] : undefined;
  const correct = mine?.option != null && mine.option === round.outlierIndex;
  const explanation = explanationFor(round);
  return (
    <View style={styles.phase}>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('offside.round', {round: state.round, total: state.rounds})}
        </Text>
      </GlassTag>

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

      <CardGrid
        cards={round.cards}
        selectedIndex={mine?.option ?? null}
        correctIndex={round.outlierIndex}
      />
      <Text variant="secondary" color="secondary" align="center">
        {t(explanation.key, explanation.params)}
      </Text>

      {isHost ? (
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
  isHost,
  onAdvance,
}: {
  state: OffsideState;
  isHost: boolean;
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

      {isHost ? (
        <Button
          label={
            lastRound ? t('offside.reveal.toStandings') : t('offside.reveal.next')
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

/** Final board. The host can run it back with a fresh deck or end the party. */
function StandingsPhase({
  state,
  isHost,
  onPlayAgain,
  onBackToLobby,
}: {
  state: OffsideState;
  isHost: boolean;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
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
      {isHost ? (
        <View style={styles.resultActions}>
          <Button
            label={t('offside.playAgain')}
            variant="primary"
            onPress={onPlayAgain}
          />
          <Button
            label={t('offside.backToLobby')}
            variant="secondary"
            onPress={onBackToLobby}
          />
        </View>
      ) : (
        <Text variant="secondary" color="secondary" align="center" style={styles.waiting}>
          {t('offside.waitingHost')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  // Centres the question in the space below the header.
  phaseWrap: {flex: 1, justifyContent: 'center'},
  phaseWrapTop: {justifyContent: 'flex-start'},
  phase: {gap: spacing.lg, alignItems: 'stretch'},
  // Quiet glass round pill, shared with Red Card's look.
  roundPill: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  roundText: {letterSpacing: 1},
  headline: {color: colors.ink},
  topicText: {letterSpacing: 1, marginTop: -spacing.sm},
  pointsLine: {color: colors.success, marginTop: -spacing.sm},
  resultActions: {gap: spacing.md, marginTop: spacing.sm},
  waiting: {marginTop: spacing.md},
});
