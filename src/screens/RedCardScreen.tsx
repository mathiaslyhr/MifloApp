import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {ChevronLeft, HelpCircle, Crown} from 'lucide-react-native';
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
  toast,
  TopStatusFade,
} from '../core/ui';
import {haptics} from '../core/haptics';
import {ReportBugModal} from '../core/feedback/ReportBugModal';
import {BugReportLink} from '../core/feedback/BugReportLink';
import {colors, fonts, radii, screenPadding, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {
  castRedCardVote,
  getMyRedCardRole,
  redCardGuess,
  playMove,
  restartRedCardGame,
  returnToLobby,
  subscribeRoom,
  type ImposterRoleResult,
} from '../core/rooms/roomService';
import {ensureSession} from '../core/supabase/client';
import {FOOTBALLERS, getById} from '../data/football';
import {searchPlayers} from '../games/hattrick/playerSearch';
import {flagImage} from '../games/hattrick/criterionIcon';
import {FootballerCard} from '../games/red-card/FootballerCard';
import {
  advanceAsk,
  buildFootballerPool,
  nameOf,
  standings,
} from '../games/red-card/engine';
import {ROUNDS} from '../games/red-card/types';
import type {ImposterPlayer, ImposterState} from '../games/red-card/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RedCard'>;

export function RedCardScreen({route, navigation}: Props) {
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
    getMyRedCardRole(roomId)
      .then(r => {
        if (r) {
          setRole(r);
        } else {
          setTimeout(() => {
            getMyRedCardRole(roomId)
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
      <Screen canvas edges={['left', 'right', 'bottom']}>
        <View style={styles.loading}>
          <Text variant="body" color="secondary">
            {t('redCard.loading')}
          </Text>
        </View>
        <FloatingBar edge="top" style={styles.chromeBar}>
          <View style={styles.chromeRow}>
            <CircleButton
              size={36}
              accessibilityLabel={t('redCard.backToLobby')}
              onPress={handleBack}>
              <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
            </CircleButton>
          </View>
        </FloatingBar>
        <TopStatusFade />
      </Screen>
    );
  }

  const myTurn = state.turnUserId === myUserId;


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
    castRedCardVote(roomId, targetUserId).catch(() => {
      setHasVoted(false);
      toast.error(t('redCard.errorVote'));
    });
  }

  function submitGuess(footballerId: string) {
    setGuessOpen(false);
    setQuery('');
    haptics.press();
    redCardGuess(roomId, footballerId).catch(() => {
      toast.error(t('redCard.errorGuess'));
    });
  }

  async function playAgain() {
    try {
      await restartRedCardGame(roomId, buildFootballerPool());
    } catch {
      toast.error(t('redCard.newGameError'));
    }
  }

  const showRoleOverlay = state.phase === 'asking' && !roleDismissed;

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
            {t('redCard.title')}
          </Text>
        </View>

        {/* Short phases (asking/voting) centre in the space below the header;
            the tall reveal top-aligns so it scrolls normally. */}
        <View
          style={[
            styles.phaseWrap,
            state.phase === 'reveal' && styles.phaseWrapTop,
          ]}>
          {state.phase === 'asking' ? (
            <AskingPhase state={state} myTurn={myTurn} onDone={finishAsk} />
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
        </View>

        <BugReportLink
          label={t('redCard.reportBug')}
          onPress={() => setShowBug(true)}
        />
      </ScrollView>

      {/* Pinned floating corner buttons (back left, help right) — stay put while
          the wordmark scrolls away. */}
      <FloatingBar edge="top" style={styles.chromeBar}>
        <View style={styles.chromeRow}>
          <CircleButton
            size={36}
            accessibilityLabel={t('redCard.backToLobby')}
            onPress={handleBack}>
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

      {/* Private role reveal — each device shows only its own role. */}
      <Modal visible={showRoleOverlay} transparent animationType="fade">
        <View style={styles.roleScrim}>
          <GlassCard
            blur={28}
            tintColor="rgba(255,255,255,0.6)"
            style={styles.roleCard}>
            {role == null ? (
              <Text variant="body" color="secondary" align="center">
                {t('redCard.role.loading')}
              </Text>
            ) : role.role === 'imposter' ? (
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
                <FootballerCard footballerId={role.footballerId} />
              </>
            )}
            <Button
              label={t('redCard.role.gotIt')}
              variant="primary"
              disabled={role == null}
              onPress={() => setRoleDismissed(true)}
            />
          </GlassCard>
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
            <Text variant="section" align="center">
              {t('redCard.redeem.button')}
            </Text>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder={t('redCard.searchPlaceholder')}
              autoFocus
              autoCapitalize="words"
              accessibilityLabel={t('redCard.searchPlaceholder')}
            />
            <ScrollView
              style={styles.results}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {query.trim() === '' ? (
                <Text variant="secondary" color="secondary" align="center" style={styles.hint}>
                  {t('redCard.searchHint')}
                </Text>
              ) : results.length === 0 ? (
                <Text variant="secondary" color="secondary" align="center" style={styles.hint}>
                  {t('redCard.noPlayers')}
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


function AskingPhase({
  state,
  myTurn,
  onDone,
}: {
  state: ImposterState;
  myTurn: boolean;
  onDone: () => void;
}) {
  const {t} = useTranslation();
  // The very last ask (last player in the final round) finishes the phase.
  const isLastAsk =
    state.round >= ROUNDS &&
    state.order.indexOf(state.turnUserId) === state.order.length - 1;
  return (
    <View style={styles.phase}>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('redCard.round', {round: state.round, total: ROUNDS})}
        </Text>
      </GlassTag>

      {myTurn ? (
        <>
          <Text variant="section" align="center" style={styles.headline}>
            {t('redCard.yourTurn')}
          </Text>
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.askOutLoud')}
          </Text>
          <Button
            label={isLastAsk ? t('redCard.finish') : t('redCard.next')}
            variant="primary"
            onPress={onDone}
          />
        </>
      ) : (
        <Text variant="section" align="center" style={styles.headline}>
          {t('redCard.askerTurn', {name: nameOf(state, state.turnUserId)})}
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
  // Shared "finished" beat: when everyone lands on voting, show a ready screen
  // first, then reveal the vote grid on tap.
  const [started, setStarted] = useState(false);
  return (
    <View style={styles.phase}>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('redCard.vote.pill')}
        </Text>
      </GlassTag>
      {hasVoted ? (
        <>
          <Text variant="section" align="center" style={styles.headline}>
            {t('redCard.vote.title')}
          </Text>
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.vote.waiting', {
              count: state.votedCount,
              total: state.players.length,
            })}
          </Text>
        </>
      ) : !started ? (
        <>
          <Text variant="section" align="center" style={styles.headline}>
            {t('redCard.vote.ready')}
          </Text>
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.vote.readySub')}
          </Text>
          <Button
            label={t('redCard.vote.start')}
            variant="primary"
            onPress={() => setStarted(true)}
          />
        </>
      ) : (
        <>
          <Text variant="section" align="center" style={styles.headline}>
            {t('redCard.vote.title')}
          </Text>
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.vote.hint')}
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
  const redemption = reveal.redemption;
  // A caught imposter guesses the footballer BLIND — hide the secret and the
  // final results until the guess is in. (An escaped imposter has nothing to
  // guess, so the reveal resolves immediately.)
  const awaitingGuess = reveal.caught && !redemption;
  return (
    <View style={styles.phase}>
      <Text variant="wordmark" align="center" style={styles.headline}>
        {t('redCard.reveal.imposterWas', {name: redeemedName})}
      </Text>
      <Text
        variant="section"
        align="center"
        style={{color: reveal.caught ? colors.success : colors.error}}>
        {reveal.caught ? t('redCard.reveal.caught') : t('redCard.reveal.escaped')}
      </Text>

      {awaitingGuess ? (
        amImposter ? (
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
        ) : (
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.redeem.waiting', {name: redeemedName})}
          </Text>
        )
      ) : (
        <>
          {redemption ? (
            <Text
              variant="section"
              align="center"
              style={{color: redemption.correct ? colors.success : colors.error}}>
              {redemption.correct
                ? t('redCard.redeem.correct', {name: redeemedName})
                : t('redCard.redeem.wrong', {
                    name: redeemedName,
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
            <FootballerCard footballerId={reveal.footballerId} />
          </GlassCard>

          {/* Scoreboard — this round's delta + running total, leader crowned. */}
          <GlassCard style={styles.listCard}>
            <Text variant="label" style={styles.listTitle}>
              {t('redCard.reveal.scoreboard')}
            </Text>
            {board.map((row, i) => {
              const d = reveal.deltas[row.userId] ?? 0;
              return (
                <View key={row.userId} style={styles.listRow}>
                  <View style={styles.scoreNameCol}>
                    {i === 0 ? (
                      <Crown size={14} color={colors.primary} strokeWidth={2} />
                    ) : null}
                    <Text
                      variant="body"
                      numberOfLines={1}
                      style={i === 0 ? styles.leaderName : undefined}>
                      {row.name}
                    </Text>
                  </View>
                  <View style={styles.scoreValueCol}>
                    {d !== 0 ? (
                      <Text
                        variant="secondary"
                        style={d > 0 ? styles.deltaUp : styles.delta}>
                        {d > 0 ? `+${d}` : d}
                      </Text>
                    ) : null}
                    <Text
                      variant="body"
                      style={[styles.points, i === 0 && styles.leaderScore]}>
                      {row.score}
                    </Text>
                  </View>
                </View>
              );
            })}
          </GlassCard>

          {/* Votes — de-emphasised, no card chrome. */}
          <View style={styles.votesBlock}>
            <Text variant="caption" color="muted" style={styles.votesLabel}>
              {t('redCard.reveal.votesTitle')}
            </Text>
            {Object.entries(reveal.votes).map(([voter, targetId]) => (
              <Text key={voter} variant="secondary" color="muted" style={styles.voteLine}>
                {t('redCard.reveal.votedFor', {
                  voter: nameOf(state, voter),
                  target: nameOf(state, targetId),
                })}
              </Text>
            ))}
          </View>

          {isHost ? (
            <View style={styles.resultActions}>
              <Button
                label={t('redCard.playAgain')}
                variant="primary"
                onPress={onPlayAgain}
              />
              <Button label={t('redCard.backToLobby')} variant="secondary" onPress={onBackToLobby} />
            </View>
          ) : (
            <Text variant="secondary" color="secondary" align="center" style={styles.waiting}>
              {t('redCard.waitingHost')}
            </Text>
          )}
        </>
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
          <GlassTag
            key={p.userId}
            onPress={() => onPick(p.userId)}
            accessibilityRole="button"
            accessibilityLabel={p.name}>
            <Text variant="body" style={styles.pickName}>
              {p.name}
            </Text>
          </GlassTag>
        ))}
    </View>
  );
}

/** Lightweight how-to-play sheet — the shared app-wide popover. */
function HelpModal({visible, onClose}: {visible: boolean; onClose: () => void}) {
  const {t} = useTranslation();
  return (
    <HowToPlayModal
      visible={visible}
      onClose={onClose}
      title={t('redCard.help.title')}
      lines={[{text: t('redCard.help.rule')}]}
      closeLabel={t('common.close')}
    />
  );
}

const styles = StyleSheet.create({
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center'},
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
  // Centres the active phase in the space between the header and the bug link.
  phaseWrap: {flex: 1, justifyContent: 'center'},
  phaseWrapTop: {justifyContent: 'flex-start'},
  phase: {gap: spacing.lg, alignItems: 'stretch'},
  // Quiet glass round pill (was heavy near-black ink).
  roundPill: {
    alignSelf: 'center',
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
  pickName: {color: colors.ink},
  sectionLabel: {letterSpacing: 1, marginBottom: -spacing.sm},
  redeemBox: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  listCard: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  listTitle: {fontFamily: fonts.regular, marginBottom: spacing.xs},
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  points: {fontFamily: fonts.regular, color: colors.ink},
  leaderName: {fontFamily: fonts.regular},
  leaderScore: {color: colors.primary},
  scoreNameCol: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1},
  scoreValueCol: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  delta: {color: colors.textTertiary},
  deltaUp: {color: colors.success},
  // The revealed footballer sits in a single glass card; a caught guess tints its rim.
  revealFrame: {
    alignSelf: 'stretch',
    padding: spacing.lg,
  },
  votesBlock: {gap: 2, marginTop: spacing.xs, paddingHorizontal: spacing.sm},
  votesLabel: {letterSpacing: 1, marginBottom: spacing.xs},
  voteLine: {paddingVertical: 1},
  resultActions: {gap: spacing.md, marginTop: spacing.sm},
  waiting: {marginTop: spacing.md},
  // Role reveal overlay: a dim backdrop + a centered, frosted card.
  roleScrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  roleCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 380,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  imposterTitle: {color: colors.error},
  // Shared search picker (redemption) — matches Tic-Tac-Toe.
  scrim: {
    flex: 1,
    backgroundColor: colors.scrimLight,
    justifyContent: 'flex-start',
    paddingTop: spacing.xxxl + spacing.lg,
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
    borderBottomWidth: 1,
    borderBottomColor: colors.textTertiary,
  },
  resultFlag: {width: 24, height: 18, borderRadius: 2},
  hint: {paddingVertical: spacing.lg},
});
