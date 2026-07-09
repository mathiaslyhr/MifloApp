import React, {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {ChevronLeft, HelpCircle, Plus, X} from 'lucide-react-native';
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
  TopStatusFade,
} from '../core/ui';
import {haptics} from '../core/haptics';
import {colors, screenPadding, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {getById} from '../data/football';
import {FootballerSearchModal} from '../games/shared/FootballerSearchModal';
import {FootballerCard} from '../games/red-card/FootballerCard';
import {PlayerGrid, Scoreboard, VotesBlock} from '../games/red-card/components';
import {
  advanceAskLocal,
  applyLocalRedemption,
  castLocalVote,
  createLocalGame,
  createLocalRematch,
  currentAsker,
  handoffPlayer,
  hideAndPass,
  LOCAL_MIN_PLAYERS,
  localNameOf,
  localStandings,
  showContent,
} from '../games/red-card/localEngine';
import {ROUNDS} from '../games/red-card/types';
import type {LocalRedCardState} from '../games/red-card/localEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'RedCardLocal'>;

/** Most name rows the setup offers — a couch-sized group. */
const MAX_PLAYERS = 8;

/**
 * Pass-and-play Red Card — the whole hand on one shared phone, fully offline.
 * Privacy comes from the handoff gate: the screen shows "Pass the phone to X"
 * until X taps, X sees their private content (role or vote), and it hides
 * again before the next pass. Roles and scoring run in the pure local engine;
 * questions still happen out loud around the phone.
 */
export function RedCardLocalScreen({navigation}: Props) {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<LocalRedCardState | null>(null);
  const [names, setNames] = useState<string[]>(['', '', '']);
  const [guessOpen, setGuessOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const namesReady =
    names.filter(n => n.trim().length > 0).length >= LOCAL_MIN_PLAYERS;

  function start() {
    if (!namesReady) {
      return;
    }
    haptics.press();
    setState(createLocalGame(names));
  }

  function submitGuess(footballerId: string) {
    setGuessOpen(false);
    haptics.press();
    setState(s => (s ? applyLocalRedemption(s, footballerId) : s));
  }

  const tallReveal = state?.stage === 'reveal';

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
            {t('redCard.title')}
          </Text>
        </View>

        {/* Short stages centre below the header; the tall reveal top-aligns. */}
        <View style={[styles.phaseWrap, tallReveal && styles.phaseWrapTop]}>
          {state === null ? (
            <SetupStage
              names={names}
              onChange={setNames}
              ready={namesReady}
              onStart={start}
            />
          ) : state.stage === 'roleReveal' ? (
            <RoleRevealStage state={state} onAdvance={setState} />
          ) : state.stage === 'asking' ? (
            <AskingStage state={state} onAdvance={setState} />
          ) : state.stage === 'voting' ? (
            <VotingStage state={state} onAdvance={setState} />
          ) : (
            <RevealStage
              state={state}
              onShowContent={() => setState(s => (s ? showContent(s) : s))}
              onGuess={() => setGuessOpen(true)}
              onPlayAgain={() => {
                haptics.press();
                setState(s => (s ? createLocalRematch(s) : s));
              }}
              onExit={() => navigation.goBack()}
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
            accessibilityLabel={t('redCard.local.exit')}
            onPress={() => navigation.goBack()}>
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

      {/* Imposter redemption — a blind search over every footballer. */}
      <FootballerSearchModal
        visible={guessOpen}
        title={t('redCard.redeem.button')}
        titleVariant="section"
        placeholder={t('redCard.searchPlaceholder')}
        hint={t('redCard.searchHint')}
        empty={t('redCard.noPlayers')}
        onPick={submitGuess}
        onClose={() => setGuessOpen(false)}
      />

      <HowToPlayModal
        visible={showHelp}
        onClose={() => setShowHelp(false)}
        title={t('redCard.help.title')}
        lines={[{text: t('redCard.help.rule')}]}
      />
    </Screen>
  );
}

/** Name entry: one field per player, add/remove rows, start at 3+. */
function SetupStage({
  names,
  onChange,
  ready,
  onStart,
}: {
  names: string[];
  onChange: (names: string[]) => void;
  ready: boolean;
  onStart: () => void;
}) {
  const {t} = useTranslation();
  return (
    <View style={styles.phase}>
      <Text variant="section" align="center" style={styles.headline}>
        {t('redCard.local.setupTitle')}
      </Text>
      <Text variant="secondary" color="secondary" align="center">
        {t('redCard.local.setupSub', {count: LOCAL_MIN_PLAYERS})}
      </Text>
      <View style={styles.nameList}>
        {names.map((name, i) => (
          <View key={i} style={styles.nameRow}>
            <View style={styles.nameField}>
              <TextField
                value={name}
                onChangeText={value =>
                  onChange(names.map((n, j) => (j === i ? value : n)))
                }
                placeholder={t('redCard.local.namePlaceholder')}
                autoCapitalize="words"
                maxLength={20}
                accessibilityLabel={t('redCard.local.namePlaceholder')}
              />
            </View>
            {names.length > LOCAL_MIN_PLAYERS ? (
              <CircleButton
                size={36}
                accessibilityLabel={t('redCard.local.removePlayer')}
                onPress={() => onChange(names.filter((_, j) => j !== i))}>
                <X size={16} color={colors.ink} strokeWidth={2} />
              </CircleButton>
            ) : null}
          </View>
        ))}
      </View>
      {names.length < MAX_PLAYERS ? (
        <GlassTag
          onPress={() => onChange([...names, ''])}
          accessibilityRole="button"
          accessibilityLabel={t('redCard.local.addPlayer')}
          style={styles.addTag}>
          <Plus size={16} color={colors.ink} strokeWidth={2} />
          <Text variant="body" style={styles.addLabel}>
            {t('redCard.local.addPlayer')}
          </Text>
        </GlassTag>
      ) : null}
      <Button
        label={t('redCard.local.start')}
        variant="primary"
        disabled={!ready}
        onPress={onStart}
      />
    </View>
  );
}

/** Full-screen "Pass the phone to X" gate with one action to show the content. */
function PassGate({
  name,
  sub,
  actionLabel,
  onShow,
}: {
  name: string;
  sub: string;
  actionLabel: string;
  onShow: () => void;
}) {
  const {t} = useTranslation();
  return (
    <>
      <Text variant="section" align="center" style={styles.headline}>
        {t('redCard.local.passTo', {name})}
      </Text>
      <Text variant="secondary" color="secondary" align="center">
        {sub}
      </Text>
      <Button
        label={actionLabel}
        variant="primary"
        onPress={() => {
          haptics.tap();
          onShow();
        }}
      />
    </>
  );
}

/** The phone goes around once; each player privately sees their role. */
function RoleRevealStage({
  state,
  onAdvance,
}: {
  state: LocalRedCardState;
  onAdvance: (next: LocalRedCardState) => void;
}) {
  const {t} = useTranslation();
  const player = handoffPlayer(state);
  if (!player) {
    return null;
  }
  if (!state.contentShown) {
    return (
      <View style={styles.phase}>
        <PassGate
          name={player.name}
          sub={t('redCard.local.roleIntro', {name: player.name})}
          actionLabel={t('redCard.local.showRole')}
          onShow={() => onAdvance(showContent(state))}
        />
      </View>
    );
  }
  const isImposter = player.id === state.imposterId;
  return (
    <View style={styles.phase}>
      <GlassCard blur={28} tintColor="rgba(255,255,255,0.6)" style={styles.roleCard}>
        {isImposter ? (
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
            <FootballerCard footballerId={state.footballerId} />
          </>
        )}
        <Button
          label={t('redCard.local.hideAndPass')}
          variant="primary"
          onPress={() => {
            haptics.tap();
            onAdvance(hideAndPass(state));
          }}
        />
      </GlassCard>
    </View>
  );
}

/** Questions happen out loud; the phone just tracks whose turn it is. */
function AskingStage({
  state,
  onAdvance,
}: {
  state: LocalRedCardState;
  onAdvance: (next: LocalRedCardState) => void;
}) {
  const {t} = useTranslation();
  const asker = currentAsker(state);
  // The very last ask (last player in the final round) finishes the phase.
  const isLastAsk =
    state.round >= ROUNDS && state.turnIndex === state.order.length - 1;
  return (
    <View style={styles.phase}>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('redCard.round', {round: state.round, total: ROUNDS})}
        </Text>
      </GlassTag>
      <Text variant="section" align="center" style={styles.headline}>
        {t('redCard.askerTurn', {name: asker?.name ?? ''})}
      </Text>
      <Text variant="secondary" color="secondary" align="center">
        {t('redCard.askOutLoud')}
      </Text>
      <Button
        label={isLastAsk ? t('redCard.finish') : t('redCard.next')}
        variant="primary"
        onPress={() => {
          haptics.press();
          onAdvance(advanceAskLocal(state));
        }}
      />
    </View>
  );
}

/** The phone goes around again; each player secretly taps their vote. */
function VotingStage({
  state,
  onAdvance,
}: {
  state: LocalRedCardState;
  onAdvance: (next: LocalRedCardState) => void;
}) {
  const {t} = useTranslation();
  const voter = handoffPlayer(state);
  if (!voter) {
    return null;
  }
  return (
    <View style={styles.phase}>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('redCard.vote.pill')}
        </Text>
      </GlassTag>
      {!state.contentShown ? (
        <PassGate
          name={voter.name}
          sub={t('redCard.local.voteIntro')}
          actionLabel={t('redCard.local.showVote')}
          onShow={() => onAdvance(showContent(state))}
        />
      ) : (
        <>
          <Text variant="section" align="center" style={styles.headline}>
            {t('redCard.vote.title')}
          </Text>
          <Text variant="secondary" color="secondary" align="center">
            {t('redCard.vote.hint')}
          </Text>
          <PlayerGrid
            players={state.players.map(p => ({userId: p.id, name: p.name}))}
            excludeId={voter.id}
            onPick={id => {
              haptics.press();
              onAdvance(castLocalVote(state, id));
            }}
          />
        </>
      )}
    </View>
  );
}

/**
 * The end of the hand. A caught imposter first gets the phone for a blind
 * redemption guess (secret + scoreboard stay hidden); then everything goes
 * public: secret footballer, points, and who voted for whom.
 */
function RevealStage({
  state,
  onShowContent,
  onGuess,
  onPlayAgain,
  onExit,
}: {
  state: LocalRedCardState;
  onShowContent: () => void;
  onGuess: () => void;
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const {t} = useTranslation();
  const reveal = state.reveal;
  if (!reveal) {
    return null;
  }
  const imposterName = localNameOf(state, state.imposterId);
  const redemption = reveal.redemption;
  const awaitingGuess = state.stage === 'redemption';
  return (
    <View style={styles.phase}>
      <Text variant="wordmark" align="center" style={styles.headline}>
        {t('redCard.reveal.imposterWas', {name: imposterName})}
      </Text>
      <Text
        variant="section"
        align="center"
        style={{color: reveal.caught ? colors.success : colors.error}}>
        {reveal.caught ? t('redCard.reveal.caught') : t('redCard.reveal.escaped')}
      </Text>

      {awaitingGuess ? (
        !state.contentShown ? (
          <PassGate
            name={imposterName}
            sub={t('redCard.local.redeemPass')}
            actionLabel={t('redCard.redeem.button')}
            onShow={onShowContent}
          />
        ) : (
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
        )
      ) : (
        <>
          {redemption ? (
            <Text
              variant="section"
              align="center"
              style={{color: redemption.correct ? colors.success : colors.error}}>
              {redemption.correct
                ? t('redCard.redeem.correct', {name: imposterName})
                : t('redCard.redeem.wrong', {
                    name: imposterName,
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
            <FootballerCard footballerId={state.footballerId} />
          </GlassCard>

          <Scoreboard
            rows={localStandings(state).map(r => ({
              userId: r.id,
              name: r.name,
              score: r.score,
            }))}
            deltas={reveal.deltas}
          />

          <VotesBlock votes={reveal.votes} nameOf={id => localNameOf(state, id)} />

          <View style={styles.resultActions}>
            <Button
              label={t('redCard.playAgain')}
              variant="primary"
              onPress={onPlayAgain}
            />
            <Button
              label={t('redCard.local.exit')}
              variant="secondary"
              onPress={onExit}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  // Centres the active stage below the header; the tall reveal top-aligns.
  phaseWrap: {flex: 1, justifyContent: 'center'},
  phaseWrapTop: {justifyContent: 'flex-start'},
  phase: {gap: spacing.lg, alignItems: 'stretch'},
  headline: {color: colors.ink},
  // Quiet glass round pill — same as online Red Card.
  roundPill: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  roundText: {letterSpacing: 1},
  nameList: {gap: spacing.sm},
  nameRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  nameField: {flex: 1},
  addTag: {alignSelf: 'center'},
  addLabel: {color: colors.ink},
  sectionLabel: {letterSpacing: 1, marginBottom: -spacing.sm},
  // Private role card — same frosted recipe as the online role overlay.
  roleCard: {gap: spacing.lg, padding: spacing.xl},
  imposterTitle: {color: colors.error},
  redeemBox: {gap: spacing.sm, padding: spacing.md},
  // The revealed footballer sits in a single glass card; a caught guess tints its rim.
  revealFrame: {alignSelf: 'stretch', padding: spacing.lg},
  resultActions: {gap: spacing.md, marginTop: spacing.sm},
});
