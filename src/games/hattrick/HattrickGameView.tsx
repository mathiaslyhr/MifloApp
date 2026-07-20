import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChevronLeft, HelpCircle, Plus} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import {
  BOARD_TEXT_SCALE,
  Button,
  CircleButton,
  Card,
  PressableScale,
  Screen,
  Skeleton,
  Text,
  toast,
  type ToastTone,
} from '../../core/ui';
import {haptics} from '../../core/haptics';
import {
  fonts,
  screenPadding,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../../theme';
import {AxisInfoModal} from './AxisInfoModal';
import {HelpModal} from './HelpModal';
import {getById} from '../../data/football';
import {criterionLabel, criterionShortLabel} from './grid';
import {criterionIcon, criterionImage} from './criterionIcon';
import {ArtIcon} from './assets/ArtIcon';
import {useSearch} from '../shared/SearchScreen';
import {playerSource} from '../shared/searchSources';
import {
  applyMove,
  boardNumberOf,
  cellCriteria,
  matchScores,
  passTurn,
  sideOfUser,
  TURN_SECONDS,
  validatePick,
} from './engine';
import {tieExampleAnswers} from './tieExamples';
import type {Criterion, Footballer} from '../../data/football';
import type {Beat, GridState} from './types';

/**
 * Who is looking at the board:
 * - `online`: one device per player — only `myUserId`'s turns are interactive,
 *   and the tie handshake tracks what THIS player has answered.
 * - `local`: one shared phone (pass-and-play) — whoever holds the phone acts
 *   for the side whose turn it is, so the board is always interactive.
 */
export type HattrickPerspective =
  | {kind: 'online'; myUserId: string | null}
  | {kind: 'local'};

type Props = {
  state: GridState | null;
  perspective: HattrickPerspective;
  /**
   * Ship a state the view computed with the pure engine (a claim or a pass).
   * Online: `playMove` RPC; local: plain `setState`.
   */
  onCommit: (next: GridState) => void;
  /** Tie handshake — RPCs online, pure engine calls local. */
  onProposeTie: () => void;
  onRespondTie: (accept: boolean) => void;
  onPlayAgain: () => void;
  /** Secondary result action (online host: back to lobby; local: exit). */
  onExit: () => void;
  exitLabel: string;
  onBack: () => void;
  /** Result screen shows Play again + exit (host online, always local). */
  showResultActions: boolean;
  /**
   * Solo-vs-AI only. When set, the board corner offers a single **Surrender**
   * (instead of Skip / propose-a-Tie — those are "nobody knows another answer"
   * negotiations between people, and there's nothing to negotiate with the bot).
   * Conceding ends the board for the AI and reveals the "what could have been"
   * answers in the empty cells.
   */
  onSurrender?: () => void;
};

const ROW_LABEL_W = 58;
const LABEL_GAP = 8;
// Hairline dividers on the board — same language as the menu cards.
// The colour is the palette's `divider`, applied inside `makeStyles`.
const DIVIDER = 1;

/**
 * The whole Hattrick game surface — board, axis bars, timer, picker, tie
 * overlay — rendered purely from `GridState`. The view computes next states
 * itself via the pure engine and hands them up through `onCommit`; where the
 * state lives (Supabase room or a local useState) is the container's business.
 */
export function HattrickGameView({
  state,
  perspective,
  onCommit,
  onProposeTie,
  onRespondTie,
  onPlayAgain,
  onExit,
  exitLabel,
  onBack,
  showResultActions,
  onSurrender,
}: Props) {
  const soloSurrender = !!onSurrender;
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const openSearch = useSearch();
  const [pickCell, setPickCell] = useState<number | null>(null);
  const [explain, setExplain] = useState<Criterion | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const local = perspective.kind === 'local';
  // Local: the phone holder always acts for whoever's turn it is.
  const actingUserId = local
    ? state?.turnUserId ?? null
    : perspective.myUserId;

  // One board sized from the screen so every cell is identical. Layout is
  // [row-label | gap | board]; the board is a single surface card split into a
  // 3×3 by white dividers.
  const {width} = useWindowDimensions();
  const cellSize = Math.floor(
    (width - screenPadding * 2 - ROW_LABEL_W - LABEL_GAP) / 3,
  );
  const boardSize = cellSize * 3;
  const headerH = Math.round(cellSize * 0.82);

  const myTurn =
    !!state &&
    !state.winner &&
    !!actingUserId &&
    state.turnUserId === actingUserId;

  // "What could have been" — after an agreed tie, each empty cell shows a
  // grayed example answer. Empty map unless winner === 'tie'.
  const tieExamples = useMemo(
    () => (state ? tieExampleAnswers(state) : new Map<number, Footballer>()),
    [state],
  );

  // Drive the turn countdown: re-render 4×/sec so the timer bar animates.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // When the active turn runs out, pass automatically (fires once per turn —
  // the deadline is the dedupe key). Online only the active player's device
  // advances the state; local the shared phone always does.
  const timedOutFor = useRef<number | null>(null);
  useEffect(() => {
    if (!state || state.winner || !actingUserId) {
      return;
    }
    const expired = nowTs >= state.turnDeadline;
    const mine = state.turnUserId === actingUserId;
    if (expired && mine && timedOutFor.current !== state.turnDeadline) {
      timedOutFor.current = state.turnDeadline;
      // Dismiss the player picker if it's still open — the turn is gone.
      setPickCell(null);
      onCommit(passTurn(state, actingUserId, 'timeout'));
    }
  }, [nowTs, state, actingUserId, onCommit]);

  // Commentary beats: replay a beat exactly once per seq change. The first
  // snapshot only primes the counter — a rejoining device must not re-announce
  // a moment that already happened. The haptic fires here too, so the moment
  // lands physically on EVERY device (the watcher's phone, not just the
  // actor's).
  //
  // A beat announces through the toast stack, not a full-screen scrim: it is
  // news about the match, and news is what toasts are for. It also means a
  // "GOAL!" never blanks out the board you're reading — the scoreline is
  // already pinned above it, so the call is all a beat has to carry.
  // The beat is shared state, but the toast is drawn per device — so the phone
  // can say whose moment it was, and colour it from where you're standing.
  // Green means YOU did well and red means YOU did badly; anything the opponent
  // did is neutral news. A beat coloured by kind alone told the watcher green
  // when they conceded and red when their rival blundered, which is the colour
  // rule (success/error = right/wrong) saying the opposite of what happened.
  //
  // Pass-and-play is exempt on purpose: one device, two people, no "you". It
  // keeps the neutral, everybody-gets-named voice.
  const seenBeatSeq = useRef<number | null>(null);
  const prevTurnUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!state) {
      return;
    }
    const beat = state.beat ?? null;
    const turnIsMine = !!actingUserId && state.turnUserId === actingUserId;
    // The turn passing TO you is the thing you'd otherwise miss: a skip hands it
    // over in silence, and even a "MISSED!" never said whose move it now was.
    const turnCameToMe =
      !local && turnIsMine && prevTurnUserId.current !== state.turnUserId;

    // First snapshot primes both counters: a device that joins (or rejoins)
    // mid-match must not re-announce moments that already happened.
    if (seenBeatSeq.current === null) {
      seenBeatSeq.current = beat?.seq ?? 0;
      prevTurnUserId.current = state.turnUserId ?? null;
      return;
    }
    prevTurnUserId.current = state.turnUserId ?? null;

    const isNewBeat = !!beat && beat.seq !== seenBeatSeq.current;
    if (isNewBeat) {
      seenBeatSeq.current = beat.seq;
      BEAT_HAPTIC[beat.kind]();
      const side = beat.sideId
        ? state.sides.find(s => s.id === beat.sideId)
        : undefined;
      const name = side?.name ?? t('hattrick.someone');
      const mySideId =
        !local && actingUserId ? sideOfUser(state, actingUserId)?.id : undefined;
      const mine = !!beat.sideId && beat.sideId === mySideId;

      const call = local
        ? {
            goal: t('hattrick.beatGoal', {name}),
            level: t('hattrick.beatLevel', {name}),
            winner: t('hattrick.beatWinner', {name}),
            draw: t('hattrick.beatDraw'),
            missed: t('hattrick.beatMissed'),
            timeout: t('hattrick.beatTimeout'),
          }[beat.kind]
        : mine
          ? {
              goal: t('hattrick.beatGoalYou'),
              level: t('hattrick.beatLevelYou'),
              winner: t('hattrick.beatWinnerYou'),
              draw: t('hattrick.beatDraw'),
              missed: t('hattrick.beatMissed'),
              timeout: t('hattrick.beatTimeout'),
            }[beat.kind]
          : {
              goal: t('hattrick.beatGoal', {name}),
              level: t('hattrick.beatLevel', {name}),
              winner: t('hattrick.beatWinner', {name}),
              draw: t('hattrick.beatDraw'),
              missed: t('hattrick.beatMissedThem', {name}),
              timeout: t('hattrick.beatTimeoutThem', {name}),
            }[beat.kind];

      toast.show({
        // One toast, not two: when a beat is what handed you the turn, it says
        // so itself rather than stacking a second card on top of it.
        message: turnCameToMe ? `${call}. ${t('hattrick.yourTurn')}` : call,
        tone: local || !mine ? BEAT_TONE_THEIRS[beat.kind] : BEAT_TONE_MINE[beat.kind],
        duration: BEAT_HOLD_MS[beat.kind],
      });
      return;
    }

    // A quiet handover — a plain skip, or the start of a new board. Nothing
    // announced it before, so the opponent just sat there.
    if (turnCameToMe) {
      haptics.tap();
      toast.neutral(t('hattrick.yourTurn'));
    }
  }, [state, t, local, actingUserId]);

  if (!state) {
    // Ghost board while the room state primes over realtime.
    return (
      <Screen canvas>
        <Header onBack={onBack} />
        <View
          style={styles.loading}
          accessibilityLabel={t('hattrick.loading')}>
          <View style={styles.loadingBoard}>
            {Array.from({length: 9}, (_, i) => (
              <Skeleton key={i} width="31%" height={96} />
            ))}
          </View>
        </View>
      </Screen>
    );
  }

  const turnSide = sideOfUser(state, state.turnUserId);

  // Pending "agree to a tie" offer. Online any player can propose and everyone
  // must accept; local the responder is simply the side that hasn't accepted.
  const viewerSideId =
    (!local &&
      perspective.myUserId &&
      sideOfUser(state, perspective.myUserId)?.id) ||
    null;
  const tieOffer = state.tieOffer ?? null;
  // Local never waits: the response resolves the offer on the spot.
  const tieWaiting =
    !local && !!tieOffer && !!viewerSideId && tieOffer.accepted.includes(viewerSideId);
  const tieProposerName = tieOffer
    ? state.sides.find(s => s.id === tieOffer.by)?.name ?? t('hattrick.someone')
    : '';
  // Corner shows Skip (my turn) and/or Tie (no active offer); vs the AI it holds
  // a single Surrender instead. Blank (an invisible spacer) once decided.
  const cornerEmpty = soloSurrender
    ? !!state.winner
    : !!state.winner || (!myTurn && !!tieOffer);

  function openPicker(index: number) {
    if (!state) {
      return;
    }
    setPickCell(index);
    const criteria = cellCriteria(state, index);
    openSearch(playerSource(state.usedFootballerIds), {
      title: `${criterionLabel(criteria.row)}  ×  ${criterionLabel(criteria.col)}`,
      placeholder: t('hattrick.searchPlaceholder'),
      emptyHint: t('hattrick.searchHint'),
      noMatch: t('hattrick.noPlayers'),
    }).then(item => {
      setPickCell(null);
      if (item) {
        submitPick(item.id, index);
      }
    });
  }

  function submitPick(footballerId: string, cell: number) {
    if (!actingUserId || !state) {
      return;
    }
    if (validatePick(state, cell, footballerId)) {
      const next = applyMove(state, cell, footballerId, actingUserId);
      // A plain claim buzzes here; a claim that triggers a beat (goal/level/
      // winner) leaves the buzz to the beat effect so it never fires twice.
      if ((next.beat?.seq ?? 0) === (state.beat?.seq ?? 0)) {
        haptics.success();
      }
      onCommit(next);
    } else {
      // The "MISSED!" beat announces (and buzzes) on every device — no local
      // toast or haptic needed.
      onCommit(passTurn(state, actingUserId, 'missed'));
    }
  }

  // Skip the current turn (nobody knows an answer): pass without claiming a cell.
  function handleSkip() {
    if (!myTurn || !actingUserId || !state) {
      return;
    }
    haptics.tap();
    toast.neutral(t('hattrick.turnSkipped'));
    onCommit(passTurn(state, actingUserId));
  }

  function handleProposeTie() {
    haptics.press();
    onProposeTie();
  }

  // Concede to the AI: ends the board and reveals "what could have been".
  function handleSurrender() {
    haptics.warning();
    onSurrender?.();
  }

  function handleRespondTie(accept: boolean) {
    if (accept) {
      haptics.success();
    } else {
      haptics.tap();
    }
    onRespondTie(accept);
  }

  // Result is coloured by the winner's side; a tie shows in the viewer's own
  // colour (neutral ink on a shared phone). No blocking pop-up — the finished
  // grid stays fully visible. A decided MATCH outranks the board result.
  const matchDone = !!state.matchWinner;
  // A surrender ends the board as a loss you chose — named plainly, in neutral
  // ink (not the winner's colour), with the "what could have been" grid below.
  const surrendered = state.endReason === 'surrender';
  const winnerColor = surrendered
    ? colors.ink
    : state.matchWinner
      ? state.matchWinner === 'draw'
        ? state.sides.find(s => s.id === viewerSideId)?.color ?? colors.ink
        : state.sides.find(s => s.id === state.matchWinner)?.color ?? colors.ink
      : state.winner === 'tie'
        ? state.sides.find(s => s.id === viewerSideId)?.color ?? colors.ink
        : state.sides.find(s => s.id === state.winner)?.color ?? colors.ink;
  const winnerText = surrendered
    ? t('hattrick.bot.surrenderedResult')
    : state.matchWinner
      ? state.matchWinner === 'draw'
        ? t('hattrick.matchDrawn')
        : t('hattrick.wonMatch', {
            name:
              state.sides.find(s => s.id === state.matchWinner)?.name ??
              t('hattrick.someone'),
          })
      : state.winner
        ? state.winner === 'tie'
          ? t('hattrick.tie')
          : t('hattrick.won', {
              name: state.sides.find(s => s.id === state.winner)?.name ?? t('hattrick.someone'),
            })
        : '';

  return (
    <Screen canvas>
      <Header onBack={onBack} onHelp={() => setShowHelp(true)} />

      <View style={styles.center}>
        {/* The match scoreline + board count — always in view. */}
        <ScoreStrip state={state} />

        {/* Turn indicator — on a shared phone it always names the side up next. */}
        <View style={styles.turnRow}>
          {!state.winner ? (
            <Text
              variant="section"
              align="center"
              style={{color: turnSide?.color ?? colors.ink}}>
              {myTurn && !local
                ? t('hattrick.yourTurn')
                : t('hattrick.othersTurn', {name: turnSide?.name ?? ''})}
            </Text>
          ) : (
            <Text variant="section" align="center" style={{color: winnerColor}}>
              {winnerText}
            </Text>
          )}
        </View>

        {/* Column headers: corner actions (skip/tie) + a header bar split into 3 */}
        <View style={styles.topRow}>
          <Card
            style={[
              styles.card,
              styles.corner,
              {width: ROW_LABEL_W, height: headerH, marginRight: LABEL_GAP},
              // Only draw the card when it actually holds an action;
              // otherwise stay an invisible spacer to keep board alignment.
              cornerEmpty && styles.cornerBlank,
            ]}>
            {soloSurrender ? (
              !state.winner ? (
                <PressableScale
                  containerStyle={styles.cornerBtn}
                  onPress={handleSurrender}
                  accessibilityRole="button"
                  accessibilityLabel={t('hattrick.bot.surrender')}>
                  <Text
                    variant="caption"
                    align="center"
                    numberOfLines={1}
                    adjustsFontSizeToFit>
                    {t('hattrick.bot.surrender')}
                  </Text>
                </PressableScale>
              ) : null
            ) : (
              <>
                {!state.winner && myTurn ? (
                  <PressableScale
                    containerStyle={styles.cornerBtn}
                    onPress={handleSkip}
                    accessibilityRole="button"
                    accessibilityLabel={t('hattrick.skip')}>
                    <Text
                      variant="caption"
                      align="center"
                      numberOfLines={1}
                      adjustsFontSizeToFit>
                      {t('hattrick.skipShort')}
                    </Text>
                  </PressableScale>
                ) : null}
                {!state.winner && myTurn && !tieOffer ? (
                  <View style={styles.cornerDiv} />
                ) : null}
                {!state.winner && !tieOffer ? (
                  <PressableScale
                    containerStyle={styles.cornerBtn}
                    onPress={handleProposeTie}
                    accessibilityRole="button"
                    accessibilityLabel={t('hattrick.proposeTie')}>
                    <Text
                      variant="caption"
                      align="center"
                      numberOfLines={1}
                      adjustsFontSizeToFit>
                      {t('hattrick.tieShort')}
                    </Text>
                  </PressableScale>
                ) : null}
              </>
            )}
          </Card>
          <Card style={[styles.card, {width: boardSize, height: headerH, flexDirection: 'row'}]}>
            {state.cols.map((c, i) => (
              <AxisCell
                key={`c${i}`}
                criterion={c}
                w={cellSize}
                h={headerH}
                divider={i > 0 ? 'left' : null}
                onPress={() => {
                  haptics.tap();
                  setExplain(c);
                }}
              />
            ))}
          </Card>
        </View>

        {/* Row headers + the board */}
        <View style={styles.bottomRow}>
          <Card style={[styles.card, {width: ROW_LABEL_W, height: boardSize, marginRight: LABEL_GAP}]}>
            {state.rows.map((c, i) => (
              <AxisCell
                key={`r${i}`}
                criterion={c}
                w={ROW_LABEL_W}
                h={cellSize}
                divider={i > 0 ? 'top' : null}
                onPress={() => {
                  haptics.tap();
                  setExplain(c);
                }}
              />
            ))}
          </Card>

          <Card style={[styles.card, {width: boardSize, height: boardSize}]}>
            {[0, 1, 2].map(r => (
              <View key={`row${r}`} style={{flexDirection: 'row'}}>
                {[0, 1, 2].map(c => {
                  const index = r * 3 + c;
                  const cell = state.board[index];
                  const selected = pickCell === index;
                  const cellStyle = [
                    styles.cell,
                    {width: cellSize, height: cellSize},
                    c > 0 && styles.divLeft,
                    r > 0 && styles.divTop,
                  ];
                  if (cell) {
                    const side = state.sides.find(s => s.id === cell.sideId);
                    const f = getById(cell.footballerId);
                    return (
                      <View
                        key={c}
                        style={[
                          cellStyle,
                          {backgroundColor: `${side?.color ?? colors.ink}22`},
                        ]}>
                        <Text
                          align="center"
                          numberOfLines={2}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                          maxFontSizeMultiplier={BOARD_TEXT_SCALE}
                          style={[styles.cellName, {color: side?.color ?? colors.ink}]}>
                          {f?.name ?? '?'}
                        </Text>
                      </View>
                    );
                  }
                  const example = tieExamples.get(index);
                  if (example) {
                    return (
                      <View
                        key={c}
                        style={cellStyle}
                        accessibilityLabel={t('hattrick.exampleAnswer', {
                          name: example.name,
                        })}>
                        <Text
                          align="center"
                          numberOfLines={2}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                          maxFontSizeMultiplier={BOARD_TEXT_SCALE}
                          style={[styles.cellName, styles.cellGhost]}>
                          {example.name}
                        </Text>
                      </View>
                    );
                  }
                  return (
                    <Pressable
                      key={c}
                      style={cellStyle}
                      disabled={!myTurn}
                      onPress={() => openPicker(index)}
                      accessibilityLabel={t('hattrick.claimCell')}>
                      {myTurn ? (
                        <Plus
                          size={24}
                          color={selected ? colors.primary : colors.muted}
                          strokeWidth={2}
                        />
                      ) : null}
                      {selected ? (
                        <View style={styles.cellSelected} pointerEvents="none" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Card>
        </View>

        {state.winner ? (
          showResultActions ? (
            <View style={styles.resultActions}>
              {/* Mid-match a finished board leads to the next one; only a
                  decided match offers a true rematch. */}
              <Button
                label={matchDone ? t('hattrick.playAgain') : t('hattrick.nextBoard')}
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
              {t('hattrick.waitingHost')}
            </Text>
          )
        ) : (
          <View style={styles.liveControls}>
            <TurnTimer deadline={state.turnDeadline} nowTs={nowTs} />
          </View>
        )}
      </View>

      {/* Tie prompt floats above the board so it never reflows the grid. */}
      {tieOffer ? (
        <TieOverlay
          waiting={tieWaiting}
          accepted={tieOffer.accepted.length}
          total={state.sides.length}
          proposerName={tieProposerName}
          onRespond={handleRespondTie}
        />
      ) : null}

      <AxisInfoModal criterion={explain} onClose={() => setExplain(null)} />
      <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </Screen>
  );
}

/** Top bar: back button (left) + centered title + a help (?) action (right,
 * matching the back button width so the title stays optically centred). */
function Header({onBack, onHelp}: {onBack: () => void; onHelp?: () => void}) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.header}>
      <CircleButton size={36} accessibilityLabel={t('hattrick.back')} onPress={onBack}>
        <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
      </CircleButton>
      <Text variant="wordmark" align="center" numberOfLines={1} style={styles.title}>
        {t('hattrick.title')}
      </Text>
      {onHelp ? (
        <CircleButton size={36} accessibilityLabel={t('hattrick.legendButton')} onPress={onHelp}>
          <HelpCircle size={18} color={colors.ink} strokeWidth={2} />
        </CircleButton>
      ) : (
        <View style={{width: 36}} />
      )}
    </View>
  );
}

/**
 * One axis label inside a header bar: a real flag/crest image (preferred) or an
 * emoji, stacked over the text label. Clubs → crest, nationalities → flag; other
 * criteria fall back to emoji, and text-only when there is no visual at all.
 */
function AxisCell({
  criterion,
  w,
  h,
  divider,
  onPress,
}: {
  criterion: Criterion;
  w: number;
  h: number;
  divider: 'left' | 'top' | null;
  onPress?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const image = criterionImage(criterion);
  const emoji = image == null ? criterionIcon(criterion) : null;
  const hasVisual = image != null || emoji != null;
  const label = criterionShortLabel(criterion);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({pressed}) => [
        styles.axis,
        {width: w, height: h},
        divider === 'left' && styles.divLeft,
        divider === 'top' && styles.divTop,
        pressed && styles.axisPressed,
      ]}>
      <ArtIcon
        image={image}
        emoji={emoji}
        imageStyle={criterion.kind === 'nationality' ? styles.axisFlag : styles.axisLogo}
        emojiStyle={styles.axisIcon}
      />
      <Text
        align="center"
        // A single word must never wrap ("Teammat / e") — shrink it instead;
        // multi-word labels ("Golden Boot") still get two lines.
        numberOfLines={label.includes(' ') ? 2 : 1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={BOARD_TEXT_SCALE}
        style={[
          styles.axisText,
          criterion.kind === 'shirtNumber'
            ? styles.axisNumber
            : !hasVisual && styles.axisTextOnly,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Turn countdown pinned to the bottom: a "Time left" label + m:ss and a bar that
 * drains and shifts colour (green → yellow → orange → red) as time runs out.
 */
function TurnTimer({deadline, nowTs}: {deadline: number; nowTs: number}) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const remainingMs = Math.max(0, deadline - nowTs);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const fraction = Math.max(0, Math.min(1, remainingMs / (TURN_SECONDS * 1000)));
  // 5-stop ramp: dark green → light green → yellow → orange → red.
  const color =
    fraction > 0.66
      ? colors.timer[0]
      : fraction > 0.4
      ? colors.timer[1]
      : fraction > 0.22
      ? colors.timer[2]
      : fraction > 0.1
      ? colors.timer[3]
      : colors.timer[4];
  const mmss = `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, '0')}`;
  return (
    <View style={styles.timerBar}>
      <View style={styles.timerLabelRow}>
        <Text variant="label">{t('hattrick.timeLeft')}</Text>
        <Text variant="label" style={[styles.timerTime, fraction <= 0.1 && {color}]}>
          {mmss}
        </Text>
      </View>
      <View style={styles.timerTrack}>
        <View
          style={[styles.timerFill, {width: `${fraction * 100}%`, backgroundColor: color}]}
        />
      </View>
    </View>
  );
}

/** The match scoreline + the board count, always in view above the board.
 *
 * The score is the point of this strip, so it never yields to a name: in the
 * 1v1 case (every online/local friendly) it sits on its own centered row, so a
 * long profile name can never shove it off-centre, with the two names smaller
 * on the row below — each owning half the width and truncating into it. Names
 * arrive from profiles and run to 20 characters. Teams / >2 sides fall back to
 * the compact inline "name value" per side. */
function ScoreStrip({state}: {state: GridState}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const scores = matchScores(state);
  const boardLabel = (
    <Text variant="caption" color="tertiary" align="center">
      {t('hattrick.board', {n: boardNumberOf(state)})}
    </Text>
  );

  if (state.sides.length === 2) {
    const [a, b] = state.sides;
    return (
      <View style={styles.scoreStrip} accessibilityRole="text">
        <View style={styles.scoreRow}>
          <Text variant="wordmark" style={[styles.scoreValue, {color: a.color}]}>
            {scores[a.id] ?? 0}
          </Text>
          <Text variant="wordmark" color="tertiary" style={styles.scoreDash}>
            –
          </Text>
          <Text variant="wordmark" style={[styles.scoreValue, {color: b.color}]}>
            {scores[b.id] ?? 0}
          </Text>
        </View>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={[styles.nameLeft, {color: a.color}]}>
            {a.name}
          </Text>
          <Text numberOfLines={1} style={[styles.nameRight, {color: b.color}]}>
            {b.name}
          </Text>
        </View>
        {boardLabel}
      </View>
    );
  }

  return (
    <View style={styles.scoreStrip} accessibilityRole="text">
      <View style={styles.scoreRowInline}>
        {state.sides.map((s, i) => (
          <React.Fragment key={s.id}>
            {i > 0 ? (
              <Text variant="section" color="tertiary" style={styles.scoreDashInline}>
                –
              </Text>
            ) : null}
            <View style={styles.scoreSide}>
              <Text
                variant="section"
                numberOfLines={1}
                style={[styles.scoreName, {color: s.color}]}>
                {s.name}
              </Text>
              <Text variant="section" style={[styles.scoreValueInline, {color: s.color}]}>
                {scores[s.id] ?? 0}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>
      {boardLabel}
    </View>
  );
}

/**
 * The tone a beat speaks in, from where you're standing. The rule: colour
 * describes YOUR action and nobody else's — green you did well, red you did
 * badly. Everything the opponent does is neutral news, because there is no
 * honest colour for "they scored": it isn't your success, and it isn't your
 * mistake either.
 *
 * `timeout` stays neutral even for you: the clock ran out, which isn't a wrong
 * answer, and `draw`/`winner` land next to a result screen that already says it.
 */
const BEAT_TONE_MINE: Record<Beat['kind'], ToastTone> = {
  goal: 'success',
  level: 'success',
  winner: 'success',
  draw: 'neutral',
  missed: 'error',
  timeout: 'neutral',
};

const BEAT_TONE_THEIRS: Record<Beat['kind'], ToastTone> = {
  goal: 'neutral',
  level: 'neutral',
  winner: 'neutral',
  draw: 'neutral',
  missed: 'neutral',
  timeout: 'neutral',
};

/** How long each beat holds before fading — score moments linger. */
const BEAT_HOLD_MS: Record<Beat['kind'], number> = {
  goal: 1900,
  level: 1900,
  winner: 2600,
  draw: 2600,
  missed: 1400,
  timeout: 1700,
};

/** The buzz each beat lands with — on every device, actor and watcher alike. */
const BEAT_HAPTIC: Record<Beat['kind'], () => void> = {
  goal: haptics.success,
  level: haptics.success,
  winner: haptics.success,
  draw: haptics.tap,
  missed: haptics.error,
  timeout: haptics.warning,
};

/** Tie prompt as a floating card pinned to the bottom. Rendered outside the
 * centered game column so it never reflows the board (fades/slides in like a
 * toast). Non-blocking: the grid stays interactive underneath. */
function TieOverlay({
  waiting,
  accepted,
  total,
  proposerName,
  onRespond,
}: {
  waiting: boolean;
  accepted: number;
  total: number;
  proposerName: string;
  onRespond: (accept: boolean) => void;
}) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {toValue: 1, duration: 180, useNativeDriver: true}),
      Animated.timing(translateY, {toValue: 0, duration: 180, useNativeDriver: true}),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.tieOverlay,
        {bottom: insets.bottom + spacing.xl, opacity, transform: [{translateY}]},
      ]}>
      <Card style={styles.tieCard}>
        <View style={styles.tieContent}>
          {waiting ? (
            <>
              <Text variant="secondary" align="center">
                {t('hattrick.tieWaiting', {accepted, total})}
              </Text>
              <Button
                label={t('common.cancel')}
                variant="outline"
                fullWidth={false}
                onPress={() => onRespond(false)}
              />
            </>
          ) : (
            <>
              <Text variant="secondary" align="center">
                {t('hattrick.tiePrompt', {name: proposerName})}
              </Text>
              <View style={styles.row2}>
                <View style={styles.flex1}>
                  <Button
                    label={t('hattrick.acceptTie')}
                    variant="primary"
                    onPress={() => onRespond(true)}
                  />
                </View>
                <View style={styles.flex1}>
                  <Button
                    label={t('hattrick.decline')}
                    variant="secondary"
                    onPress={() => onRespond(false)}
                  />
                </View>
              </View>
            </>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  loadingBoard: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  title: {flex: 1},
  center: {flex: 1, justifyContent: 'center'},
  // Match scoreline + board count, sitting quietly above the turn line.
  scoreStrip: {alignItems: 'center', gap: 2, paddingTop: spacing.sm, alignSelf: 'stretch'},
  // 1v1: the score on its own centered row — symmetric, so it lands on true
  // screen centre no matter how long either name is.
  scoreRow: {flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center'},
  scoreValue: {fontVariant: ['tabular-nums']},
  scoreDash: {marginHorizontal: spacing.sm},
  // 1v1: the two names below, each owning half the width and truncating into
  // the middle, so the strip stays balanced around the score above it.
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.lg,
  },
  nameLeft: {flex: 1, textAlign: 'right', paddingRight: spacing.sm, fontSize: 15, lineHeight: 20},
  nameRight: {flex: 1, textAlign: 'left', paddingLeft: spacing.sm, fontSize: 15, lineHeight: 20},
  // Teams / >2 sides: the compact inline "name value" per side. Both sides
  // shrink together so two long names give way rather than losing a score off
  // the edge of the screen.
  scoreRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.lg,
  },
  scoreSide: {flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1},
  scoreName: {flexShrink: 1},
  scoreValueInline: {flexShrink: 0, fontVariant: ['tabular-nums']},
  scoreDashInline: {flexShrink: 0, marginHorizontal: spacing.md},
  turnRow: {paddingVertical: spacing.lg, alignItems: 'center'},
  topRow: {flexDirection: 'row', alignSelf: 'center', marginBottom: LABEL_GAP},
  bottomRow: {flexDirection: 'row', alignSelf: 'center'},
  // The header bars and board clip their internal grid dividers to the corners.
  card: {overflow: 'hidden'},
  // White dividers that split a card into a grid.
  divLeft: {borderLeftWidth: DIVIDER, borderLeftColor: c.divider},
  divTop: {borderTopWidth: DIVIDER, borderTopColor: c.divider},
  // Top-left corner: Skip / Tie stacked as compact actions.
  corner: {flexDirection: 'column'},
  cornerBlank: {backgroundColor: c.transparent, borderWidth: 0},
  cornerBtn: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4},
  cornerDiv: {height: DIVIDER, backgroundColor: c.divider},
  axis: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 2,
  },
  axisPressed: {opacity: 0.55},
  axisIcon: {fontSize: 17, lineHeight: 22, textAlign: 'center'},
  // Real flag/crest images sit in the same slot the emoji used to occupy.
  axisFlag: {width: 24, height: 17, borderRadius: 2},
  axisLogo: {width: 24, height: 24},
  axisText: {fontFamily: fonts.regular, fontSize: 10, lineHeight: 14, color: c.ink},
  axisTextOnly: {fontSize: 10, lineHeight: 14},
  // Shirt number renders as pure text at the same caption size/ink as the labels.
  axisNumber: {fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: c.ink},
  // Turn countdown, pinned to the bottom of the board area.
  timerBar: {marginTop: 'auto', paddingTop: spacing.xl, paddingBottom: spacing.md},
  timerLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  timerTime: {fontVariant: ['tabular-nums']},
  timerTrack: {height: 8, borderRadius: 4, backgroundColor: c.surface2, overflow: 'hidden'},
  timerFill: {height: '100%', borderRadius: 4},
  cell: {alignItems: 'center', justifyContent: 'center', padding: 4},
  cellName: {fontFamily: fonts.regular, fontSize: 10, lineHeight: 14},
  // Ghost example answer shown in cells left empty by an agreed tie.
  cellGhost: {color: c.muted, opacity: 0.45},
  // Purple ring marking the cell you're currently filling.
  cellSelected: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: c.primary,
  },
  resultActions: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  waiting: {marginTop: spacing.xl},
  // In-progress controls under the board: timer + skip/tie (or the tie prompt).
  liveControls: {alignSelf: 'stretch', gap: spacing.md},
  row2: {flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch'},
  flex1: {flex: 1},
  // Floating tie card, pinned bottom over the board — offset with the safe area
  // inline so it clears the home indicator on every device.
  tieOverlay: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    alignItems: 'stretch',
  },
  // Floating tie card with a bespoke, tighter lift than the shared floating
  // recipe — it hovers close over the board.
  tieCard: {
    shadowColor: c.shadowInk,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 6,
  },
  tieContent: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  });
