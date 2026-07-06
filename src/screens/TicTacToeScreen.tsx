import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {ChevronLeft} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Button, CircleButton, Screen, Text, TextField} from '../core/ui';
import {colors, fonts, radii, screenPadding, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {
  playMove,
  restartBoardGame,
  returnToLobby,
  subscribeRoom,
} from '../core/rooms/roomService';
import {ensureSession} from '../core/supabase/client';
import {FOOTBALLERS, getById} from '../data/football';
import {
  criterionLabel,
  criterionShortLabel,
  generateGrid,
} from '../games/tic-tac-toe/grid';
import {
  criterionIcon,
  criterionImage,
  flagImage,
} from '../games/tic-tac-toe/criterionIcon';
import {
  applyMove,
  cellCriteria,
  createIndividualState,
  passTurn,
  sideOfUser,
  TURN_SECONDS,
  validatePick,
} from '../games/tic-tac-toe/engine';
import type {Criterion} from '../data/football';
import type {GridState} from '../games/tic-tac-toe/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TicTacToe'>;

const ROW_LABEL_W = 58;
const LABEL_GAP = 8;
// White hairline dividers on the glass board — same language as the menu cards.
const DIVIDER = 1.5;
const DIVIDER_COLOR = colors.glassRim;

export function TicTacToeScreen({route, navigation}: Props) {
  const {roomId} = route.params;
  const [state, setState] = useState<GridState | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [pickCell, setPickCell] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const leftRef = useRef(false);

  // One board sized from the screen so every cell is identical. Layout is
  // [row-label | gap | board]; the board is a single glass card split into a
  // 3×3 by white dividers.
  const {width} = useWindowDimensions();
  const cellSize = Math.floor(
    (width - screenPadding * 2 - ROW_LABEL_W - LABEL_GAP) / 3,
  );
  const boardSize = cellSize * 3;
  const headerH = Math.round(cellSize * 0.82);

  useEffect(() => {
    ensureSession().then(setMyUserId).catch(() => {});
    const unsub = subscribeRoom(roomId, room => {
      setHostId(room.hostId);
      // Host ended the game / returned to lobby → follow back.
      if (room.status !== 'in_progress' || !room.gameState) {
        if (!leftRef.current) {
          leftRef.current = true;
          navigation.goBack();
        }
        return;
      }
      setState(room.gameState as GridState);
    });
    return unsub;
  }, [roomId, navigation]);

  const isHost = !!myUserId && myUserId === hostId;
  const myTurn = !!state && state.turnUserId === myUserId && !state.winner;

  // Drive the turn countdown: re-render 4×/sec so the timer bar animates.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // When my turn runs out, pass automatically (fires once per turn — the
  // deadline is the dedupe key). Only the active player advances the state.
  const timedOutFor = useRef<number | null>(null);
  useEffect(() => {
    if (!state || state.winner || !myUserId) {
      return;
    }
    const expired = nowTs >= state.turnDeadline;
    const mine = state.turnUserId === myUserId;
    if (expired && mine && timedOutFor.current !== state.turnDeadline) {
      timedOutFor.current = state.turnDeadline;
      playMove(roomId, passTurn(state, myUserId)).catch(() => {});
    }
  }, [nowTs, state, myUserId, roomId]);

  // Unused footballers matching the search. Empty query shows nothing (no
  // pre-search) — results only appear once the player starts typing.
  const results = useMemo(() => {
    if (!state) {
      return [];
    }
    const q = query.trim().toLowerCase();
    if (!q) {
      return [];
    }
    return FOOTBALLERS.filter(
      f =>
        !state.usedFootballerIds.includes(f.id) &&
        f.name.toLowerCase().includes(q),
    ).slice(0, 40);
  }, [query, state]);

  // Back: a guest just leaves to their (still-mounted) lobby and can rejoin; the
  // host returns the whole party to the lobby to pick a new game.
  function handleBack() {
    if (isHost) {
      returnToLobby(roomId).catch(() => {});
    } else {
      leftRef.current = true;
      navigation.goBack();
    }
  }

  if (!state) {
    return (
      <Screen canvas>
        <Header onBack={handleBack} />
        <View style={styles.loading}>
          <Text variant="body" color="secondary">
            Loading…
          </Text>
        </View>
      </Screen>
    );
  }

  const turnSide = sideOfUser(state, state.turnUserId);

  function openPicker(index: number) {
    setQuery('');
    setPickCell(index);
  }

  function submitPick(footballerId: string) {
    const cell = pickCell;
    setPickCell(null);
    if (cell === null || !myUserId || !state) {
      return;
    }
    if (validatePick(state, cell, footballerId)) {
      playMove(roomId, applyMove(state, cell, footballerId, myUserId)).catch(() => {});
    } else {
      Alert.alert('Not a match', "That player doesn't fit — your turn passes.");
      playMove(roomId, passTurn(state, myUserId)).catch(() => {});
    }
  }

  async function playAgain() {
    if (!state) {
      return;
    }
    const roster = state.sides.map(s => ({
      userId: s.memberUserIds[0],
      name: s.name,
    }));
    try {
      await restartBoardGame(roomId, createIndividualState(generateGrid(), roster));
    } catch {
      Alert.alert('Miflo', "Couldn't start a new game.");
    }
  }

  // Result is coloured by the winner's side; a tie shows in the viewer's own
  // colour. No blocking pop-up — the finished grid stays fully visible.
  const winnerColor =
    state.winner === 'tie'
      ? state.sides.find(s => s.id === myUserId)?.color ?? colors.ink
      : state.sides.find(s => s.id === state.winner)?.color ?? colors.ink;
  const winnerText = state.winner
    ? state.winner === 'tie'
      ? "It's a tie!"
      : `${state.sides.find(s => s.id === state.winner)?.name ?? 'Someone'} won`
    : '';

  return (
    <Screen canvas>
      <Header onBack={handleBack} />

      <View style={styles.center}>
        {/* Turn indicator */}
        <View style={styles.turnRow}>
          {!state.winner ? (
            <Text
              variant="section"
              align="center"
              style={{color: turnSide?.color ?? colors.ink}}>
              {myTurn ? 'Your turn' : `${turnSide?.name ?? ''}'s turn`}
            </Text>
          ) : (
            <Text variant="section" align="center" style={{color: winnerColor}}>
              {winnerText}
            </Text>
          )}
        </View>

        {/* Column headers: empty corner + a glass bar split into 3 */}
        <View style={styles.topRow}>
          <View style={{width: ROW_LABEL_W, height: headerH, marginRight: LABEL_GAP}} />
          <View style={[styles.card, {width: boardSize, height: headerH, flexDirection: 'row'}]}>
            {state.cols.map((c, i) => (
              <AxisCell
                key={`c${i}`}
                criterion={c}
                w={cellSize}
                h={headerH}
                divider={i > 0 ? 'left' : null}
              />
            ))}
          </View>
        </View>

        {/* Row headers (glass bar) + the board */}
        <View style={styles.bottomRow}>
          <View style={[styles.card, {width: ROW_LABEL_W, height: boardSize, marginRight: LABEL_GAP}]}>
            {state.rows.map((c, i) => (
              <AxisCell
                key={`r${i}`}
                criterion={c}
                w={ROW_LABEL_W}
                h={cellSize}
                divider={i > 0 ? 'top' : null}
              />
            ))}
          </View>

          <View style={[styles.card, {width: boardSize, height: boardSize}]}>
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
                          numberOfLines={3}
                          style={[styles.cellName, {color: side?.color ?? colors.ink}]}>
                          {f?.name ?? '?'}
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
                      accessibilityLabel="Claim cell">
                      {myTurn ? (
                        <Text style={[styles.plus, selected && styles.plusOn]}>+</Text>
                      ) : null}
                      {selected ? (
                        <View style={styles.cellSelected} pointerEvents="none" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {state.winner ? (
          isHost ? (
            <View style={styles.resultActions}>
              <Button label="Play again" variant="primary" onPress={playAgain} />
              <Button
                label="Back to lobby"
                variant="secondary"
                onPress={() => returnToLobby(roomId).catch(() => {})}
              />
            </View>
          ) : (
            <Text
              variant="secondary"
              color="secondary"
              align="center"
              style={styles.waiting}>
              Waiting for the host…
            </Text>
          )
        ) : (
          <TurnTimer deadline={state.turnDeadline} nowTs={nowTs} />
        )}
      </View>

      {/* Footballer picker — light scrim so the selected (purple) cell stays visible */}
      <Modal
        visible={pickCell !== null}
        transparent
        animationType="none"
        onRequestClose={() => setPickCell(null)}>
        <Pressable style={styles.scrim} onPress={() => setPickCell(null)}>
          <Pressable style={styles.pickCard} onPress={() => {}}>
            <Text variant="label" align="center">
              {pickCell !== null
                ? `${criterionLabel(cellCriteria(state, pickCell).row)}  ×  ${criterionLabel(
                    cellCriteria(state, pickCell).col,
                  )}`
                : ''}
            </Text>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder="Search a footballer"
              autoFocus
              autoCapitalize="words"
              accessibilityLabel="Search a footballer"
            />
            <ScrollView
              style={styles.results}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {query.trim() === '' ? (
                <Text variant="secondary" color="secondary" align="center" style={styles.hint}>
                  Start typing to search a footballer
                </Text>
              ) : results.length === 0 ? (
                <Text variant="secondary" color="secondary" align="center" style={styles.hint}>
                  No players found
                </Text>
              ) : (
                results.map(f => {
                  const flag = flagImage(f.nationality[0]);
                  return (
                    <Pressable
                      key={f.id}
                      style={styles.resultRow}
                      onPress={() => submitPick(f.id)}>
                      {flag != null ? (
                        <Image source={flag} resizeMode="contain" style={styles.resultFlag} />
                      ) : null}
                      <Text variant="body">{f.name}</Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

/** Top bar: back button (left) + centered title. The right spacer matches the
 * back button width so the title stays optically centred. */
function Header({onBack}: {onBack: () => void}) {
  return (
    <View style={styles.header}>
      <CircleButton size={36} accessibilityLabel="Back to lobby" onPress={onBack}>
        <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
      </CircleButton>
      <Text variant="wordmark" align="center" numberOfLines={1} style={styles.title}>
        Football Grid
      </Text>
      <View style={{width: 36}} />
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
}: {
  criterion: Criterion;
  w: number;
  h: number;
  divider: 'left' | 'top' | null;
}) {
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
          style={criterion.kind === 'club' ? styles.axisLogo : styles.axisFlag}
        />
      ) : emoji ? (
        <Text style={styles.axisIcon}>{emoji}</Text>
      ) : null}
      <Text
        align="center"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[styles.axisText, !hasVisual && styles.axisTextOnly]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Turn countdown pinned to the bottom: a "Time left" label + m:ss and a bar that
 * drains and shifts colour (green → yellow → orange → red) as time runs out.
 */
function TurnTimer({deadline, nowTs}: {deadline: number; nowTs: number}) {
  const remainingMs = Math.max(0, deadline - nowTs);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const fraction = Math.max(0, Math.min(1, remainingMs / (TURN_SECONDS * 1000)));
  const color =
    fraction > 0.66
      ? '#3FBF63' // dark green
      : fraction > 0.4
      ? '#8FD79E' // light green
      : fraction > 0.22
      ? '#E6C34E' // yellow
      : fraction > 0.1
      ? '#E1893E' // orange
      : '#E15749'; // red
  const mmss = `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, '0')}`;
  return (
    <View style={styles.timerBar}>
      <View style={styles.timerLabelRow}>
        <Text style={styles.timerLabel}>Time left</Text>
        <Text style={[styles.timerTime, fraction <= 0.1 && {color}]}>{mmss}</Text>
      </View>
      <View style={styles.timerTrack}>
        <View
          style={[styles.timerFill, {width: `${fraction * 100}%`, backgroundColor: color}]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  title: {flex: 1},
  center: {flex: 1, justifyContent: 'center'},
  turnRow: {paddingVertical: spacing.lg, alignItems: 'center'},
  topRow: {flexDirection: 'row', alignSelf: 'center', marginBottom: LABEL_GAP},
  bottomRow: {flexDirection: 'row', alignSelf: 'center'},
  // Glass card shared by both header bars and the board.
  card: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassRim,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  // White dividers that split a card into a grid.
  divLeft: {borderLeftWidth: DIVIDER, borderLeftColor: DIVIDER_COLOR},
  divTop: {borderTopWidth: DIVIDER, borderTopColor: DIVIDER_COLOR},
  axis: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 2,
  },
  axisIcon: {fontSize: 17, lineHeight: 22, textAlign: 'center'},
  // Real flag/crest images sit in the same slot the emoji used to occupy.
  axisFlag: {width: 24, height: 17, borderRadius: 2},
  axisLogo: {width: 24, height: 24},
  axisText: {fontFamily: fonts.medium, fontSize: 11, lineHeight: 13, color: colors.ink},
  axisTextOnly: {fontSize: 12.5, lineHeight: 15},
  // Turn countdown, pinned to the bottom of the board area.
  timerBar: {marginTop: 'auto', paddingTop: spacing.xl, paddingBottom: spacing.md},
  timerLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  timerLabel: {fontFamily: fonts.medium, fontSize: 15, color: colors.ink},
  timerTime: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  timerTrack: {height: 8, borderRadius: 4, backgroundColor: colors.glassRim, overflow: 'hidden'},
  timerFill: {height: '100%', borderRadius: 4},
  cell: {alignItems: 'center', justifyContent: 'center', padding: 4},
  cellName: {fontFamily: fonts.medium, fontSize: 12, lineHeight: 15},
  plus: {fontFamily: fonts.regular, fontSize: 26, color: colors.primary, opacity: 0.3},
  plusOn: {opacity: 1},
  // Purple ring marking the cell you're currently filling.
  cellSelected: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(13,13,22,0.15)',
    justifyContent: 'flex-start',
    paddingTop: 72,
    paddingHorizontal: spacing.xl,
  },
  pickCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 380,
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  results: {maxHeight: 300},
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  resultFlag: {width: 22, height: 16, borderRadius: 2},
  hint: {paddingVertical: spacing.lg},
  resultActions: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  waiting: {marginTop: spacing.xl},
});
