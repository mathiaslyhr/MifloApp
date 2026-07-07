import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {ChevronLeft, HelpCircle, Bug} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Button,
  CircleButton,
  PressableScale,
  Screen,
  Text,
  TextField,
  toast,
} from '../core/ui';
import {haptics} from '../core/haptics';
import {ReportBugModal} from '../core/feedback/ReportBugModal';
import {colors, fonts, radii, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {
  castImposterVote,
  getMyImposterRole,
  imposterGuess,
  playMove,
  restartImposterGame,
  returnToLobby,
  subscribeRoom,
  type ImposterRoleResult,
} from '../core/rooms/roomService';
import {ensureSession} from '../core/supabase/client';
import {FOOTBALLERS, getById} from '../data/football';
import {searchPlayers} from '../games/tic-tac-toe/playerSearch';
import {flagImage} from '../games/tic-tac-toe/criterionIcon';
import {FootballerCard} from '../games/footballer-imposter/FootballerCard';
import {
  advanceAsk,
  buildFootballerPool,
  nameOf,
  setAskTarget,
  standings,
} from '../games/footballer-imposter/engine';
import {ROUNDS} from '../games/footballer-imposter/types';
import type {ImposterPlayer, ImposterState} from '../games/footballer-imposter/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FootballerImposter'>;

export function FootballerImposterScreen({route, navigation}: Props) {
  const {roomId} = route.params;
  const {t} = useTranslation();
  const [state, setState] = useState<ImposterState | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [role, setRole] = useState<ImposterRoleResult | null>(null);
  const [roleDismissed, setRoleDismissed] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [guessOpen, setGuessOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showBug, setShowBug] = useState(false);
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
    );
    return unsub;
  }, [roomId, navigation]);

  // Fetch ONLY my own role from the server (never in the broadcast state). The
  // secret is written before the room flips to in_progress, but retry once in
  // case this device sees the state first.
  const fetchRole = useCallback(() => {
    getMyImposterRole(roomId)
      .then(r => {
        if (r) {
          setRole(r);
        } else {
          setTimeout(() => {
            getMyImposterRole(roomId)
              .then(rr => rr && setRole(rr))
              .catch(() => {});
          }, 600);
        }
      })
      .catch(() => {});
  }, [roomId]);

  // A hand always opens in the 'asking' phase. Each time we enter it fresh (first
  // mount, or Play again after a reveal), reset per-hand local state and re-fetch
  // the role — Play again re-randomises the imposter and footballer.
  useEffect(() => {
    if (!state) {
      return;
    }
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;
    if (state.phase === 'asking' && prev !== 'asking') {
      setRole(null);
      setRoleDismissed(false);
      setHasVoted(false);
      fetchRole();
    }
  }, [state?.phase, state, fetchRole]);

  const isHost = !!myUserId && myUserId === hostId;

  const results = useMemo(
    () => (query.trim() === '' ? [] : searchPlayers(FOOTBALLERS, query, [])),
    [query],
  );

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
            {t('imposter.loading')}
          </Text>
        </View>
      </Screen>
    );
  }

  const myTurn = state.turnUserId === myUserId;

  function pickAskTarget(targetUserId: string) {
    if (!state || !myTurn) {
      return;
    }
    haptics.tap();
    playMove(roomId, setAskTarget(state, targetUserId)).catch(() => {});
  }

  function finishAsk() {
    if (!state) {
      return;
    }
    haptics.press();
    playMove(roomId, advanceAsk(state)).catch(() => {});
  }

  function castVote(targetUserId: string) {
    if (hasVoted) {
      return;
    }
    setHasVoted(true);
    haptics.press();
    castImposterVote(roomId, targetUserId).catch(() => {
      setHasVoted(false);
      toast.error(t('imposter.errorVote'));
    });
  }

  function submitGuess(footballerId: string) {
    setGuessOpen(false);
    setQuery('');
    haptics.press();
    imposterGuess(roomId, footballerId).catch(() => {
      toast.error(t('imposter.errorGuess'));
    });
  }

  async function playAgain() {
    try {
      await restartImposterGame(roomId, buildFootballerPool());
    } catch {
      toast.error(t('imposter.newGameError'));
    }
  }

  // A persistent reminder of your own secret (footballer or "the imposter"),
  // tappable to re-open the full role card.
  const roleChip =
    role == null ? null : (
      <Pressable
        onPress={() => setRoleDismissed(false)}
        hitSlop={8}
        style={styles.roleChip}
        accessibilityRole="button">
        <Text variant="caption" color="muted">
          {role.role === 'imposter'
            ? t('imposter.youAreImposter')
            : t('imposter.youAre', {
                player: getById(role.footballerId)?.name ?? '',
              })}
        </Text>
      </Pressable>
    );

  const showRoleOverlay = state.phase === 'asking' && !roleDismissed;

  return (
    <Screen canvas>
      <Header onBack={handleBack} onHelp={() => setShowHelp(true)} />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        {state.phase === 'asking' ? (
          <AskingPhase
            state={state}
            myUserId={myUserId}
            myTurn={myTurn}
            onPickTarget={pickAskTarget}
            onDone={finishAsk}
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
            onBackToLobby={() => returnToLobby(roomId).catch(() => {})}
          />
        )}

        {state.phase !== 'reveal' ? roleChip : null}

        <Pressable
          onPress={() => setShowBug(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('imposter.reportBug')}
          style={styles.bugLink}>
          <Bug size={14} color={colors.muted} strokeWidth={2} />
          <Text variant="caption" color="muted">
            {t('imposter.reportBug')}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Private role reveal — each device shows only its own role. */}
      <Modal visible={showRoleOverlay} transparent animationType="fade">
        <View style={styles.roleScrim}>
          <View style={styles.roleCard}>
            {role == null ? (
              <Text variant="body" color="secondary" align="center">
                {t('imposter.role.loading')}
              </Text>
            ) : role.role === 'imposter' ? (
              <>
                <Text variant="title" align="center" style={styles.imposterTitle}>
                  {t('imposter.role.imposterTitle')}
                </Text>
                <Text variant="body" color="secondary" align="center">
                  {t('imposter.role.imposterBody')}
                </Text>
              </>
            ) : (
              <>
                <Text variant="secondary" color="secondary" align="center">
                  {t('imposter.role.detectiveIntro')}
                </Text>
                <FootballerCard footballerId={role.footballerId} />
              </>
            )}
            <Button
              label={t('imposter.role.gotIt')}
              variant="primary"
              disabled={role == null}
              onPress={() => setRoleDismissed(true)}
            />
          </View>
        </View>
      </Modal>

      {/* Imposter redemption — search any footballer. */}
      <Modal
        visible={guessOpen}
        transparent
        animationType="none"
        onRequestClose={() => setGuessOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setGuessOpen(false)}>
          <Pressable style={styles.pickCard} onPress={() => {}}>
            <Text variant="label" align="center">
              {t('imposter.redeem.button')}
            </Text>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder={t('imposter.searchPlaceholder')}
              autoFocus
              autoCapitalize="words"
              accessibilityLabel={t('imposter.searchPlaceholder')}
            />
            <ScrollView
              style={styles.results}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {query.trim() === '' ? (
                <Text variant="secondary" color="secondary" align="center" style={styles.hint}>
                  {t('imposter.searchHint')}
                </Text>
              ) : results.length === 0 ? (
                <Text variant="secondary" color="secondary" align="center" style={styles.hint}>
                  {t('imposter.noPlayers')}
                </Text>
              ) : (
                results.map(f => {
                  const flag = flagImage(f.nationality[0]);
                  return (
                    <Pressable
                      key={f.id}
                      style={styles.resultRow}
                      onPress={() => submitGuess(f.id)}>
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

      <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
      <ReportBugModal visible={showBug} onClose={() => setShowBug(false)} />
    </Screen>
  );
}

/** Top bar: back + centered title + help (?), matching Tic-Tac-Toe. */
function Header({onBack, onHelp}: {onBack: () => void; onHelp?: () => void}) {
  const {t} = useTranslation();
  return (
    <View style={styles.header}>
      <CircleButton size={36} accessibilityLabel={t('imposter.backToLobby')} onPress={onBack}>
        <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
      </CircleButton>
      <Text variant="wordmark" align="center" numberOfLines={1} style={styles.title}>
        {t('imposter.title')}
      </Text>
      {onHelp ? (
        <CircleButton size={36} accessibilityLabel={t('imposter.help.title')} onPress={onHelp}>
          <HelpCircle size={18} color={colors.ink} strokeWidth={2} />
        </CircleButton>
      ) : (
        <View style={{width: 36}} />
      )}
    </View>
  );
}

function AskingPhase({
  state,
  myUserId,
  myTurn,
  onPickTarget,
  onDone,
}: {
  state: ImposterState;
  myUserId: string | null;
  myTurn: boolean;
  onPickTarget: (userId: string) => void;
  onDone: () => void;
}) {
  const {t} = useTranslation();
  const target = state.askTargetUserId;
  return (
    <View style={styles.phase}>
      <View style={styles.roundPill}>
        <Text variant="caption" color="onInk" style={styles.roundText}>
          {t('imposter.round', {round: state.round, total: ROUNDS})}
        </Text>
      </View>

      {myTurn ? (
        target ? (
          <>
            <Text variant="section" align="center" style={styles.headline}>
              {t('imposter.yourTurnAsk', {name: nameOf(state, target)})}
            </Text>
            <Button label={t('imposter.done')} variant="primary" onPress={onDone} />
          </>
        ) : (
          <>
            <Text variant="section" align="center" style={styles.headline}>
              {t('imposter.yourTurnPick')}
            </Text>
            <PlayerGrid
              players={state.players}
              excludeId={myUserId}
              onPick={onPickTarget}
            />
          </>
        )
      ) : (
        <Text variant="section" align="center" style={styles.headline}>
          {target
            ? t('imposter.askerAsking', {
                asker: nameOf(state, state.turnUserId),
                target: nameOf(state, target),
              })
            : t('imposter.askerChoosing', {name: nameOf(state, state.turnUserId)})}
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
  return (
    <View style={styles.phase}>
      <Text variant="section" align="center" style={styles.headline}>
        {t('imposter.vote.title')}
      </Text>
      {hasVoted ? (
        <Text variant="secondary" color="secondary" align="center">
          {t('imposter.vote.waiting', {
            count: state.votedCount,
            total: state.players.length,
          })}
        </Text>
      ) : (
        <>
          <Text variant="secondary" color="secondary" align="center">
            {t('imposter.vote.hint')}
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
  return (
    <View style={styles.phase}>
      <Text variant="title" align="center" style={styles.headline}>
        {t('imposter.reveal.imposterWas', {name: redeemedName})}
      </Text>
      <Text
        variant="section"
        align="center"
        style={{color: reveal.caught ? colors.success : colors.error}}>
        {reveal.caught ? t('imposter.reveal.caught') : t('imposter.reveal.escaped')}
      </Text>

      <Text variant="caption" color="muted" align="center" style={styles.sectionLabel}>
        {t('imposter.reveal.secret')}
      </Text>
      <FootballerCard footballerId={reveal.footballerId} />

      {/* Redemption */}
      {reveal.caught ? (
        reveal.redemption ? (
          <Text
            variant="secondary"
            align="center"
            style={{color: reveal.redemption.correct ? colors.success : colors.textSecondary}}>
            {reveal.redemption.correct
              ? t('imposter.redeem.correct', {name: redeemedName})
              : t('imposter.redeem.wrong', {
                  name: redeemedName,
                  guess: getById(reveal.redemption.guessId)?.name ?? '',
                })}
          </Text>
        ) : amImposter ? (
          <View style={styles.redeemBox}>
            <Text variant="secondary" color="secondary" align="center">
              {t('imposter.redeem.prompt')}
            </Text>
            <Button label={t('imposter.redeem.button')} variant="primary" onPress={onGuess} />
          </View>
        ) : null
      ) : null}

      {/* Points this round */}
      <View style={styles.listCard}>
        <Text variant="label" style={styles.listTitle}>
          {t('imposter.reveal.pointsTitle')}
        </Text>
        {state.players.map(p => (
          <View key={p.userId} style={styles.listRow}>
            <Text variant="body">{p.name}</Text>
            <Text variant="body" style={styles.points}>
              {`+${reveal.deltas[p.userId] ?? 0}`}
            </Text>
          </View>
        ))}
      </View>

      {/* Running scoreboard */}
      <View style={styles.listCard}>
        <Text variant="label" style={styles.listTitle}>
          {t('imposter.reveal.scoreboard')}
        </Text>
        {board.map(row => (
          <View key={row.userId} style={styles.listRow}>
            <Text variant="body">{row.name}</Text>
            <Text variant="body" style={styles.points}>
              {row.score}
            </Text>
          </View>
        ))}
      </View>

      {/* Votes breakdown */}
      <View style={styles.listCard}>
        <Text variant="label" style={styles.listTitle}>
          {t('imposter.reveal.votesTitle')}
        </Text>
        {Object.entries(reveal.votes).map(([voter, targetId]) => (
          <Text key={voter} variant="secondary" color="secondary" style={styles.voteLine}>
            {t('imposter.reveal.votedFor', {
              voter: nameOf(state, voter),
              target: nameOf(state, targetId),
            })}
          </Text>
        ))}
      </View>

      {isHost ? (
        <View style={styles.resultActions}>
          <Button label={t('imposter.playAgain')} variant="primary" onPress={onPlayAgain} />
          <Button label={t('imposter.backToLobby')} variant="secondary" onPress={onBackToLobby} />
        </View>
      ) : (
        <Text variant="secondary" color="secondary" align="center" style={styles.waiting}>
          {t('imposter.waitingHost')}
        </Text>
      )}
    </View>
  );
}

/** Tappable roster of glass name tags; optionally hides one player (yourself). */
function PlayerGrid({
  players,
  excludeId,
  onPick,
}: {
  players: ImposterPlayer[];
  excludeId: string | null;
  onPick: (userId: string) => void;
}) {
  return (
    <View style={styles.pickGrid}>
      {players
        .filter(p => p.userId !== excludeId)
        .map(p => (
          <PressableScale
            key={p.userId}
            style={styles.pickTag}
            onPress={() => onPick(p.userId)}
            accessibilityRole="button"
            accessibilityLabel={p.name}>
            <Text variant="section" style={styles.pickName}>
              {p.name}
            </Text>
          </PressableScale>
        ))}
    </View>
  );
}

/** Lightweight how-to-play sheet (scrim + white card), matching the app pattern. */
function HelpModal({visible, onClose}: {visible: boolean; onClose: () => void}) {
  const {t} = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.helpCard} onPress={() => {}}>
          <Text variant="section" align="center">
            {t('imposter.help.title')}
          </Text>
          <Text variant="body" color="secondary">
            {t('imposter.help.rule')}
          </Text>
          <Button label={t('common.close')} variant="secondary" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
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
  body: {paddingVertical: spacing.xl, gap: spacing.lg},
  phase: {gap: spacing.lg, alignItems: 'stretch'},
  roundPill: {
    alignSelf: 'center',
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  roundText: {letterSpacing: 1},
  headline: {color: colors.ink},
  pickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pickTag: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassRim,
  },
  pickName: {color: colors.ink, fontSize: 16, lineHeight: 20},
  roleChip: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.glassRim,
  },
  sectionLabel: {letterSpacing: 1, marginBottom: -spacing.sm},
  redeemBox: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassRim,
    borderRadius: radii.card,
  },
  listCard: {
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassRim,
    borderRadius: radii.card,
  },
  listTitle: {marginBottom: spacing.xs},
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  points: {fontFamily: fonts.medium, color: colors.ink},
  voteLine: {paddingVertical: 1},
  resultActions: {gap: spacing.md, marginTop: spacing.sm},
  waiting: {marginTop: spacing.md},
  bugLink: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  // Role reveal overlay: a dim backdrop + a centered card.
  roleScrim: {
    flex: 1,
    backgroundColor: 'rgba(13,13,22,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  roleCard: {
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
  },
  imposterTitle: {color: colors.error},
  // Shared search picker (redemption) — matches Tic-Tac-Toe.
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
  helpCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 380,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.xl,
  },
});
