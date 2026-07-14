import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  AppState,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {ChevronLeft, Plus, type LucideIcon} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Button,
  CircleButton,
  FloatingBar,
  GlassCard,
  Screen,
  Text,
  toast,
} from '../core/ui';
import {haptics} from '../core/haptics';
import type {RootStackParamList} from '../core/navigation';
import {subscribePlayers, subscribeRoom} from '../core/rooms/roomService';
import {
  rhAdvance,
  rhClaimAbandon,
  rhFinish,
  rhFlag,
  rhForfeit,
  rhHeartbeat,
  rhMove,
  rhReportBlur,
  rhStart,
} from '../core/rooms/rankedService';
import {matchIdFrom} from '../core/stats/recordEntries';
import {ensureSession} from '../core/supabase/client';
import {
  fonts,
  screenPadding,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../theme';
import {getById, type Criterion} from '../data/football';
import {generateGrid, criterionShortLabel} from '../games/hattrick/grid';
import {criterionIcon, criterionImage} from '../games/hattrick/criterionIcon';
import {useSearch} from '../games/shared/SearchScreen';
import {playerSource} from '../games/shared/searchSources';
import {
  cellCriteria,
  createMatchState,
  decideMatch,
  liveRemaining,
  nextBoard,
  validateAnswer,
} from '../games/ranked-hattrick/engine';
import {
  ABANDON_MS,
  HEARTBEAT_MS,
  MATCH_BOARDS,
  MAX_BLURS,
  TURN_GRACE_MS,
} from '../games/ranked-hattrick/constants';
import type {RankedBeatKind, RankedState} from '../games/ranked-hattrick/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RankedHattrick'>;

const PLAYER_COLORS = ['#6260FF', '#FF6A61'];
// Board layout, matched to friendly Hattrick.
const ROW_LABEL_W = 58;
const LABEL_GAP = 8;
const DIVIDER = 1;

function clockLabel(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${`${s}`.padStart(2, '0')}`;
}

/**
 * Ranked Hattrick — the online, TURN-BASED competitive match. Same board visuals
 * as friendly, with a per-player chess clock. Turns/clock/scoring are decided by
 * the RPCs in migration 0036; this screen renders the authoritative state and
 * sends moves through rh_move.
 */
export function RankedHattrickScreen({route, navigation}: Props) {
  const {roomId} = route.params;
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const openSearch = useSearch();
  const {width} = useWindowDimensions();

  const cellSize = Math.floor(
    (width - screenPadding * 2 - ROW_LABEL_W - LABEL_GAP) / 3,
  );
  const boardSize = cellSize * 3;
  const headerH = Math.round(cellSize * 0.82);

  const [state, setState] = useState<RankedState | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [roster, setRoster] = useState<{userId: string; name: string}[]>([]);
  const [, setTick] = useState(0);

  const stateRef = useRef<RankedState | null>(null);
  stateRef.current = state;
  const leftRef = useRef(false);

  const matchIdFor = (s: RankedState) =>
    matchIdFrom(roomId, s.players.map(p => p.userId).slice().sort().join('-'));

  // ── Room + roster subscriptions ────────────────────────────────────────────
  useEffect(() => {
    ensureSession().then(setMyUserId).catch(() => {});
    const unsubRoom = subscribeRoom(roomId, room => {
      setHostId(room.hostId);
      if (room.status === 'finished') {
        return;
      }
      if (room.gameState) {
        setState(room.gameState as RankedState);
      }
    });
    const unsubPlayers = subscribePlayers(roomId, players =>
      setRoster(players.map(p => ({userId: p.userId, name: p.name}))),
    );
    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [roomId]);

  const isHost = !!myUserId && myUserId === hostId;
  const myTurn = !!state && !!myUserId && state.turnUserId === myUserId && !state.matchWinner && !state.boardWinner;

  // ── Host: bootstrap board 1 (server picks the fair starter) ─────────────────
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (!isHost || state || roster.length < 2 || bootstrappedRef.current) {
      return;
    }
    bootstrappedRef.current = true;
    const players = roster.slice(0, 2).map((p, i) => ({
      userId: p.userId,
      name: p.name,
      color: PLAYER_COLORS[i],
    }));
    rhStart(
      roomId,
      createMatchState(players, generateGrid(), players[0].userId, Date.now()),
    ).catch(() => toast.error(t('common.errorNetwork')));
  }, [isHost, state, roster, roomId, t]);

  // ── Host: advance boards + decide the match + apply ELO ─────────────────────
  const advanceRef = useRef<string | null>(null);
  const finishedRef = useRef(false);
  useEffect(() => {
    if (!isHost || !state) {
      return;
    }
    if (state.matchWinner !== null) {
      if (finishedRef.current) {
        return;
      }
      finishedRef.current = true;
      const [p1, p2] = state.players;
      const matchId = matchIdFor(state);
      if (state.matchWinner === 'draw') {
        rhFinish(matchId, roomId, p1.userId, p2.userId, true).catch(() => {});
      } else {
        const loser = state.matchWinner === p1.userId ? p2.userId : p1.userId;
        rhFinish(matchId, roomId, state.matchWinner, loser, false).catch(() => {});
      }
      return;
    }
    if (state.boardWinner === null) {
      return;
    }
    const key = `${state.boardNumber}:${state.boardWinner}`;
    if (advanceRef.current === key) {
      return;
    }
    advanceRef.current = key;
    if (state.boardNumber >= MATCH_BOARDS) {
      rhAdvance(roomId, decideMatch(state)).catch(() => {});
    } else {
      rhAdvance(
        roomId,
        nextBoard(state, generateGrid(Math.random, {avoid: [state.signature]}), Date.now()),
      ).catch(() => {});
    }
  }, [isHost, state, roomId]);

  // ── Live clock tick ─────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 300);
    return () => clearInterval(id);
  }, []);

  // ── Chess flag: fire rh_flag at the turn-holder's true deadline ──────────────
  useEffect(() => {
    if (!state || state.matchWinner) {
      return;
    }
    const clock = state.clocks[state.turnUserId];
    if (!clock) {
      return;
    }
    // grace is free, so the flag falls at turnStart + grace + what's left.
    const ms = state.turnStartedAt + TURN_GRACE_MS + clock.remainingMs - Date.now();
    if (ms <= 0) {
      rhFlag(roomId).catch(() => {});
      return;
    }
    const id = setTimeout(() => rhFlag(roomId).catch(() => {}), ms + 200);
    return () => clearTimeout(id);
  }, [state, roomId]);

  // ── Heartbeat + abandonment: if the opponent's app dies, claim the win ───────
  useEffect(() => {
    if (!myUserId) {
      return;
    }
    const id = setInterval(() => {
      const s = stateRef.current;
      if (!s || s.matchWinner) {
        return;
      }
      rhHeartbeat(roomId).catch(() => {});
      const opp = s.players.find(p => p.userId !== myUserId)?.userId;
      const seen = opp ? s.seen?.[opp] : undefined;
      if (opp && seen && Date.now() - seen > ABANDON_MS) {
        // The server re-checks staleness on its own clock before awarding it.
        rhClaimAbandon(matchIdFor(s), roomId).catch(() => {});
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUserId, roomId]);

  // ── Anti-cheat: report an app-background during a live match ─────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next !== 'background') {
        return;
      }
      const s = stateRef.current;
      if (s && !s.matchWinner && myUserId) {
        rhReportBlur(matchIdFor(s), roomId).catch(() => {});
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, myUserId]);

  const prevBlurs = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!state || !myUserId) {
      return;
    }
    const blurs = state.blurs ?? {};
    const opp = state.players.find(p => p.userId !== myUserId)?.userId;
    if (opp && (blurs[opp] ?? 0) > (prevBlurs.current[opp] ?? 0)) {
      toast.neutral(t('rankedHattrick.leftApp'));
    }
    const mine = blurs[myUserId] ?? 0;
    if (mine > (prevBlurs.current[myUserId] ?? 0) && mine === MAX_BLURS - 1) {
      toast.error(t('rankedHattrick.blurWarning'));
    }
    prevBlurs.current = {...blurs};
  }, [state, myUserId, t]);

  // ── Board-start toast ("X starts") ──────────────────────────────────────────
  const prevBoard = useRef(0);
  useEffect(() => {
    if (!state || state.matchWinner) {
      return;
    }
    if (state.boardNumber !== prevBoard.current) {
      prevBoard.current = state.boardNumber;
      const starter = state.players.find(p => p.userId === state.turnUserId);
      if (starter) {
        const name = starter.userId === myUserId ? t('rankedHattrick.you') : starter.name;
        toast.neutral(t('rankedHattrick.starts', {name}));
      }
    }
  }, [state, myUserId, t]);

  // ── Commentary beats → toasts ───────────────────────────────────────────────
  const seenBeat = useRef<number | null>(null);
  const activeBeat = state?.beat ?? null;
  useEffect(() => {
    if (!activeBeat) {
      return;
    }
    if (seenBeat.current === null) {
      seenBeat.current = activeBeat.seq;
      return;
    }
    if (activeBeat.seq === seenBeat.current) {
      return;
    }
    seenBeat.current = activeBeat.seq;
    const name = nameFor(stateRef.current, activeBeat.userId);
    if (activeBeat.kind === 'goal' || activeBeat.kind === 'level') {
      haptics.success();
      toast.success(t(`rankedHattrick.${activeBeat.kind}`, {name}));
    } else if (activeBeat.kind === 'missed') {
      haptics.error();
      toast.neutral(t('rankedHattrick.missed', {name: ''}));
    } else if (activeBeat.kind === 'deadBoard') {
      haptics.warning();
      toast.neutral(t('rankedHattrick.deadBoard'));
    }
    // winner / draw / outOfTime → shown by the finish panel.
  }, [activeBeat, t]);

  // ── Tap a square → search → move ────────────────────────────────────────────
  function onCellPress(cell: number) {
    const s = stateRef.current;
    if (!s || !myUserId) {
      return;
    }
    if (s.turnUserId !== myUserId || s.matchWinner || s.boardWinner || s.board[cell]) {
      return;
    }
    const {row, col} = cellCriteria(s, cell);
    openSearch(playerSource(s.usedFootballerIds), {
      title: `${criterionShortLabel(row)} · ${criterionShortLabel(col)}`,
      placeholder: t('rankedHattrick.searchPlaceholder'),
    })
      .then(item => {
        const cur = stateRef.current;
        if (!cur || cur.turnUserId !== myUserId) {
          return;
        }
        if (!item) {
          return; // cancelled — no move, still your turn (clock keeps running)
        }
        const ok = validateAnswer(cur, cell, item.id);
        rhMove(roomId, cell, ok ? item.id : undefined, ok).catch(() =>
          toast.error(t('common.errorNetwork')),
        );
        haptics.tap();
      })
      .catch(() => {});
  }

  /**
   * Walk away without touching the room. We deliberately do NOT leaveRoom: the
   * host leaving CLOSES the room, which would destroy the result before the
   * opponent's device ever reads it (a surrender looked like a hang to them).
   * The match is already settled server-side; the room goes stale on its own.
   */
  function leave() {
    if (leftRef.current) {
      return;
    }
    leftRef.current = true;
    navigation.popToTop();
  }

  function handleBack() {
    const s = stateRef.current;
    if (s && !s.matchWinner && !leftRef.current) {
      Alert.alert(
        t('rankedHattrick.surrenderTitle'),
        t('rankedHattrick.surrenderMessage'),
        [
          {text: t('rankedHattrick.surrenderCancel'), style: 'cancel'},
          {
            text: t('rankedHattrick.surrenderConfirm'),
            style: 'destructive',
            onPress: () => {
              rhForfeit(matchIdFor(s), roomId).catch(() => {});
              leave();
            },
          },
        ],
      );
      return;
    }
    leave();
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const me = state?.players.find(p => p.userId === myUserId);
  const opponent = state?.players.find(p => p.userId !== myUserId);
  const finished = !!state?.matchWinner;

  return (
    <Screen canvas edges={['left', 'right', 'bottom']}>
      <View style={[styles.body, {paddingTop: insets.top + 52}]}>
        {!state ? (
          <View style={styles.center}>
            <Text variant="body" color="secondary">
              {t('rankedHattrick.finding')}
            </Text>
          </View>
        ) : (
          <>
            {/* Clocks + scoreline */}
            <View style={styles.clocks}>
              <ClockChip
                name={me?.name ?? t('rankedHattrick.you')}
                color={me?.color ?? colors.primary}
                ms={me ? liveRemaining(state, me.userId, Date.now()) : 0}
                active={!!me && state.turnUserId === me.userId && !finished}
                out={!!(me && state.clocks[me.userId]?.out)}
              />
              <View style={styles.scoreWrap}>
                <Text style={styles.score}>
                  {me ? state.scores[me.userId] ?? 0 : 0}
                  {'  '}–{'  '}
                  {opponent ? state.scores[opponent.userId] ?? 0 : 0}
                </Text>
                <Text variant="caption" color="muted">
                  {t('rankedHattrick.board', {n: state.boardNumber, of: MATCH_BOARDS})}
                </Text>
              </View>
              <ClockChip
                name={opponent?.name ?? '—'}
                color={opponent?.color ?? colors.error}
                ms={opponent ? liveRemaining(state, opponent.userId, Date.now()) : 0}
                active={!!opponent && state.turnUserId === opponent.userId && !finished}
                out={!!(opponent && state.clocks[opponent.userId]?.out)}
                left={!!(opponent && (state.blurs?.[opponent.userId] ?? 0) > 0)}
                leftLabel={t('rankedHattrick.leftAppShort')}
                align="right"
              />
            </View>

            {!finished ? (
              <Text
                variant="label"
                align="center"
                style={[styles.turnBanner, myTurn ? {color: me?.color ?? colors.primary} : {color: colors.textSecondary}]}>
                {myTurn ? t('rankedHattrick.yourTurn') : t('rankedHattrick.opponentTurn')}
              </Text>
            ) : null}

            {/* Board — same visuals as friendly Hattrick. */}
            <View style={styles.boardArea}>
              <View style={styles.topRow}>
                <GlassCard style={[styles.card, styles.cornerBlank, {width: ROW_LABEL_W, height: headerH, marginRight: LABEL_GAP}]} />
                <GlassCard style={[styles.card, {width: boardSize, height: headerH, flexDirection: 'row'}]}>
                  {state.cols.map((c, i) => (
                    <AxisCell key={`c${i}`} criterion={c} w={cellSize} h={headerH} divider={i > 0 ? 'left' : null} />
                  ))}
                </GlassCard>
              </View>
              <View style={styles.bottomRow}>
                <GlassCard style={[styles.card, {width: ROW_LABEL_W, height: boardSize, marginRight: LABEL_GAP}]}>
                  {state.rows.map((c, i) => (
                    <AxisCell key={`r${i}`} criterion={c} w={ROW_LABEL_W} h={cellSize} divider={i > 0 ? 'top' : null} />
                  ))}
                </GlassCard>
                <GlassCard style={[styles.card, {width: boardSize, height: boardSize}]}>
                  {[0, 1, 2].map(r => (
                    <View key={`row${r}`} style={styles.gridRow}>
                      {[0, 1, 2].map(c => {
                        const index = r * 3 + c;
                        return (
                          <BoardCell
                            key={c}
                            state={state}
                            index={index}
                            size={cellSize}
                            myTurn={myTurn}
                            divider={{left: c > 0, top: r > 0}}
                            onPress={() => onCellPress(index)}
                          />
                        );
                      })}
                    </View>
                  ))}
                </GlassCard>
              </View>
            </View>

            {finished ? (
              <View style={styles.finishPanel}>
                <Text variant="section" align="center" style={styles.finishTitle}>
                  {state.matchWinner === 'draw'
                    ? t('rankedHattrick.resultDraw')
                    : state.matchWinner === myUserId
                      ? t('rankedHattrick.resultWon')
                      : t('rankedHattrick.resultLost')}
                </Text>
                {/* Why it ended — never leave the players guessing. */}
                <Text variant="secondary" color="secondary" align="center">
                  {endReasonLine(state, myUserId, t)}
                </Text>
                <Button label={t('rankedHattrick.done')} onPress={leave} />
              </View>
            ) : null}
          </>
        )}
      </View>

      <FloatingBar edge="top" style={styles.chromeBar}>
        <View style={styles.chromeRow}>
          <CircleButton size={36} accessibilityLabel={t('common.back')} onPress={handleBack}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        </View>
      </FloatingBar>
    </Screen>
  );
}

function nameFor(state: RankedState | null, userId?: string): string {
  if (!state || !userId) {
    return '';
  }
  return state.players.find(p => p.userId === userId)?.name ?? '';
}

/** Explain how the match ended — a flag, a surrender, a walkout, or the boards. */
function endReasonLine(
  state: RankedState,
  myUserId: string | null,
  t: TFunction,
): string {
  const me = state.players.find(p => p.userId === myUserId);
  const opp = state.players.find(p => p.userId !== myUserId);
  if (state.endReason === 'boards' || !state.endReason) {
    return t('rankedHattrick.reasonBoards', {
      a: me ? state.scores[me.userId] ?? 0 : 0,
      b: opp ? state.scores[opp.userId] ?? 0 : 0,
    });
  }
  // Whoever isn't the winner lost it.
  const loser =
    state.matchWinner === 'draw' || !state.matchWinner
      ? undefined
      : state.players.find(p => p.userId !== state.matchWinner)?.userId;
  const mine = loser === myUserId;
  const name = nameFor(state, loser);
  switch (state.endReason) {
    case 'timeout':
      return mine
        ? t('rankedHattrick.reasonTimeoutYou')
        : t('rankedHattrick.reasonTimeoutOpp', {name});
    case 'surrender':
      return mine
        ? t('rankedHattrick.reasonSurrenderYou')
        : t('rankedHattrick.reasonSurrenderOpp', {name});
    case 'left':
      return mine
        ? t('rankedHattrick.reasonLeftYou')
        : t('rankedHattrick.reasonLeftOpp', {name});
    default:
      return '';
  }
}

/** One axis label — flag/crest/emoji + short label, copied from HattrickGameView. */
function AxisCell({
  criterion,
  w,
  h,
  divider,
}: {
  criterion: Criterion;
  w: number;
  h: number;
  divider: 'left' | 'top' | null;
}) {
  const styles = useThemedStyles(makeStyles);
  const image = criterionImage(criterion);
  const emoji = image == null ? criterionIcon(criterion) : null;
  const hasVisual = image != null || emoji != null;
  const label = criterionShortLabel(criterion);
  return (
    <View
      style={[
        styles.axis,
        {width: w, height: h},
        divider === 'left' && styles.divLeft,
        divider === 'top' && styles.divTop,
      ]}>
      {image != null ? (
        <Image
          source={image}
          resizeMode="contain"
          style={criterion.kind === 'nationality' ? styles.axisFlag : styles.axisLogo}
        />
      ) : emoji ? (
        <Text style={styles.axisIcon}>{emoji}</Text>
      ) : null}
      <Text
        align="center"
        numberOfLines={label.includes(' ') ? 2 : 1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[
          styles.axisText,
          criterion.kind === 'shirtNumber'
            ? styles.axisNumber
            : !hasVisual && styles.axisTextOnly,
        ]}>
        {label}
      </Text>
    </View>
  );
}

function BoardCell({
  state,
  index,
  size,
  myTurn,
  divider,
  onPress,
}: {
  state: RankedState;
  index: number;
  size: number;
  myTurn: boolean;
  divider: {left: boolean; top: boolean};
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const claimed = state.board[index];
  const base = [
    styles.cell,
    {width: size, height: size},
    divider.left && styles.divLeft,
    divider.top && styles.divTop,
  ];

  if (claimed) {
    const owner = state.players.find(p => p.userId === claimed.userId);
    const f = getById(claimed.footballerId);
    return (
      <View style={[base, {backgroundColor: `${owner?.color ?? colors.ink}22`}]}>
        <Text
          align="center"
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[styles.cellName, {color: owner?.color ?? colors.ink}]}>
          {f?.name ?? '?'}
        </Text>
      </View>
    );
  }
  return (
    <Pressable style={base} disabled={!myTurn} onPress={onPress} accessibilityRole="button">
      {myTurn ? <Plus size={24} color={colors.muted} strokeWidth={2} /> : null}
    </Pressable>
  );
}

function ClockChip({
  name,
  color,
  ms,
  active,
  out,
  left,
  leftLabel,
  align,
}: {
  name: string;
  color: string;
  ms: number;
  active: boolean;
  out: boolean;
  left?: boolean;
  leftLabel?: string;
  align?: 'right';
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.clockChip, align === 'right' && styles.clockRight]}>
      <View style={styles.clockName}>
        <View style={[styles.dot, {backgroundColor: color}]} />
        <Text variant="caption" color="secondary" numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Text style={[styles.clockValue, active && {color}, out && styles.clockOut]}>
        {out ? '0:00' : clockLabel(ms)}
      </Text>
      {left && leftLabel ? (
        <Text variant="caption" style={styles.leftApp} numberOfLines={1}>
          {leftLabel}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    body: {flex: 1},
    center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
    chromeBar: {paddingHorizontal: screenPadding},
    chromeRow: {flexDirection: 'row', alignItems: 'center', height: 44, marginTop: spacing.sm},
    clocks: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: screenPadding,
    },
    clockChip: {flex: 1, gap: 2},
    clockRight: {alignItems: 'flex-end'},
    clockName: {flexDirection: 'row', alignItems: 'center', gap: 6},
    dot: {width: 8, height: 8, borderRadius: 4},
    clockValue: {
      fontFamily: fonts.medium,
      fontSize: 22,
      lineHeight: 26,
      color: c.textTertiary,
      fontVariant: ['tabular-nums'],
    },
    clockOut: {color: c.error},
    leftApp: {color: c.error, fontSize: 11, lineHeight: 14},
    scoreWrap: {alignItems: 'center', gap: 2, paddingHorizontal: spacing.md},
    score: {
      fontFamily: fonts.medium,
      fontSize: 26,
      lineHeight: 30,
      color: c.ink,
      fontVariant: ['tabular-nums'],
    },
    turnBanner: {marginTop: spacing.md},
    // Board (ported from HattrickGameView).
    boardArea: {marginTop: spacing.md},
    topRow: {flexDirection: 'row', alignSelf: 'center', marginBottom: LABEL_GAP},
    bottomRow: {flexDirection: 'row', alignSelf: 'center'},
    gridRow: {flexDirection: 'row'},
    card: {overflow: 'hidden'},
    cornerBlank: {backgroundColor: c.transparent, borderWidth: 0},
    divLeft: {borderLeftWidth: DIVIDER, borderLeftColor: c.glassRim},
    divTop: {borderTopWidth: DIVIDER, borderTopColor: c.glassRim},
    axis: {alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 4, gap: 2},
    axisIcon: {fontSize: 17, lineHeight: 22, textAlign: 'center'},
    axisFlag: {width: 24, height: 17, borderRadius: 2},
    axisLogo: {width: 24, height: 24},
    axisText: {fontFamily: fonts.regular, fontSize: 10, lineHeight: 14, color: c.ink},
    axisTextOnly: {fontSize: 10, lineHeight: 14},
    axisNumber: {fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: c.ink},
    cell: {alignItems: 'center', justifyContent: 'center', padding: 4},
    cellName: {fontFamily: fonts.regular, fontSize: 10, lineHeight: 14},
    finishPanel: {marginTop: spacing.xl, paddingHorizontal: screenPadding, gap: spacing.md},
    finishTitle: {color: c.ink},
  });
