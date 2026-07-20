import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {ChevronLeft, Flag, HelpCircle} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  BOARD_TEXT_SCALE,
  CircleButton,
  EdgeFade,
  FloatingBar,
  Screen,
  Text,
  toast,
  useEdgeFades,
} from '../core/ui';
import {haptics} from '../core/haptics';
import {
  fonts,
  radii,
  screenPadding,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {getById, getClub, POSITION_LABELS, type Footballer} from '../data/football';
import {
  enableScoutReminder,
  markScoutReminderOffered,
  shouldOfferScoutReminder,
  syncNudges,
} from '../core/notifications/scoutReminder';
import {queueDailyResult} from '../core/social/outbox';
import {fromScoutEntry, liveStreak, ongoingResult} from '../core/social/normalize';
import {flagImage, logoImage} from '../games/hattrick/criterionIcon';
import {SearchField, useSearch} from '../games/shared/SearchScreen';
import {playerSource} from '../games/shared/searchSources';
import {COLUMNS, deriveAttributes} from '../games/scout/compare';
import {
  applyGuess,
  createInitialState,
  EMPTY_STREAK,
  giveUp,
  historyEntryFor,
  isFinished,
  recordResult,
  STREAK_GUESS_LIMIT,
} from '../games/scout/engine';
import {
  dailySecretFor,
  dateKeyFor,
} from '../games/scout/dailySeed';
import {
  loadDailyProgress,
  loadStreak,
  recordHistory,
  saveDailyProgress,
  saveStreak,
} from '../games/scout/mysteryStorage';
import {MysteryHelpModal} from '../games/scout/MysteryHelpModal';
import {CellInfoModal, type CellInfo} from '../games/scout/CellInfoModal';
import type {
  CellResult,
  ColumnKey,
  MysteryState,
  StreakState,
} from '../games/scout/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Scout'>;

/** Solid fill per feedback status; white content reads on all three. These are
 * semantically fixed (Wordle tones) but `guessMiss` has a dark-tuned value, so
 * read them from the active palette. */
const statusBg = (c: Palette): Record<CellResult['status'], string> => ({
  hit: c.guessHit,
  partial: c.guessNear,
  miss: c.guessMiss,
});

/** Compact league labels for the tiny grid cell (colour carries the signal). */
const LEAGUE_SHORT: Record<string, string> = {
  'premier-league': 'PL',
  'la-liga': 'La Liga',
  'serie-a': 'Serie A',
  bundesliga: 'Bundes.',
  'ligue-1': 'Ligue 1',
  eredivisie: 'Ered.',
  'primeira-liga': 'Prim.',
  championship: 'EFL',
  mls: 'MLS',
  'saudi-pro-league': 'Saudi',
  'super-lig': 'Süper',
  'scottish-premiership': 'SPFL',
  brasileirao: 'Brasil',
  'liga-mx': 'Liga MX',
  'liga-argentina': 'Arg.',
};

function leagueShort(league: string | undefined): string {
  if (!league) {
    return '—';
  }
  return LEAGUE_SHORT[league] ?? league.split('-')[0].slice(0, 5);
}

export function ScoutScreen({navigation}: Props) {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const dateKey = useMemo(() => dateKeyFor(new Date()), []);

  const [state, setState] = useState<MysteryState | null>(null);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [showHelp, setShowHelp] = useState(false);
  const openSearch = useSearch();
  const [cellInfo, setCellInfo] = useState<CellInfo | null>(null);

  const fades = useEdgeFades();

  function showCellInfo(info: CellInfo) {
    haptics.tap();
    setCellInfo(info);
  }

  // Rehydrate today's puzzle (replaying stored guesses through the engine) and
  // the streak. No re-recording here — recordResult only runs on a live finish.
  // One-time reminder offer, shown the moment a puzzle is finished — that's
  // when a daily nudge is worth something. Declining (or iOS denying) never
  // asks again; Settings has the toggle for changed minds.
  const reminderOffered = useRef(false);
  useEffect(() => {
    if (!state || !isFinished(state) || reminderOffered.current) {
      return;
    }
    reminderOffered.current = true;
    (async () => {
      if (!(await shouldOfferScoutReminder())) {
        return;
      }
      await markScoutReminderOffered();
      Alert.alert(t('scout.reminderTitle'), t('scout.reminderPrompt'), [
        {text: t('scout.reminderNo'), style: 'cancel'},
        {
          text: t('scout.reminderYes'),
          onPress: () => {
            enableScoutReminder()
              .then(granted => {
                if (!granted) {
                  toast.error(t('scout.reminderDenied'));
                }
              })
              .catch(() => toast.error(t('scout.reminderDenied')));
          },
        },
      ]);
    })().catch(() => {});
  }, [state, t]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [progress, savedStreak] = await Promise.all([
        loadDailyProgress(dateKey),
        loadStreak(),
      ]);
      // Prefer the secret pinned when the day was first opened — the frozen
      // schedule keeps days stable across dataset edits, but the pin also
      // covers pre-schedule saves and dates beyond the schedule horizon.
      const pinned = progress?.secretId ? getById(progress.secretId) : undefined;
      const secret = pinned ?? dailySecretFor(dateKey);
      let s = createInitialState(dateKey, secret.id);
      if (progress) {
        for (const id of progress.guessedIds) {
          s = applyGuess(s, id);
        }
        if (progress.gaveUp) {
          s = giveUp(s);
        }
      }
      if (!pinned) {
        // Silent on failure — the player took no action; a failed pin only
        // matters if a guess follows, and that save warns on its own.
        saveDailyProgress({
          dateKey,
          guessedIds: progress?.guessedIds ?? [],
          secretId: secret.id,
        }).catch(() => {});
      }
      if (alive) {
        setState(s);
        setStreak(savedStreak);
      }
    })();
    return () => {
      alive = false;
    };
  }, [dateKey]);

  const guessedIds = state ? state.guesses.map(g => g.footballerId) : [];

  function openGuessSearch() {
    openSearch(playerSource(guessedIds), {
      placeholder: t('scout.searchPlaceholder'),
    }).then(item => {
      if (item) {
        submitGuess(item.id);
      }
    });
  }

  function submitGuess(footballerId: string) {
    if (!state || isFinished(state)) {
      return;
    }
    if (state.guesses.some(g => g.footballerId === footballerId)) {
      toast.neutral(t('scout.alreadyGuessed'));
      return;
    }
    const next = applyGuess(state, footballerId);
    setState(next);
    // The game keeps playing in-session either way; the toast warns that this
    // guess won't be there after a relaunch.
    const saveFailed = () => toast.error(t('scout.errorSave'));
    saveDailyProgress({
      dateKey,
      guessedIds: next.guesses.map(g => g.footballerId),
      secretId: next.secretId,
    }).catch(saveFailed);

    if (isFinished(next)) {
      haptics.success();
      finishDay(next, false);
    } else {
      haptics.tap();
      // Live "in progress" row for friends: the eye + the running guess
      // count. The finish row above replaces it (same day+game key).
      queueDailyResult(
        ongoingResult('scout', dateKey, 0, next.guesses.length, liveStreak(streak, dateKey)),
      ).catch(() => {});
    }
  }

  // Fold a finished day (a win, or a give-up) into the streak, archive, and
  // friend feed. Shared by a winning guess and by surrendering.
  function finishDay(next: MysteryState, gaveUp: boolean) {
    const updated = recordResult(streak, dateKey, next.guesses.length, gaveUp);
    setStreak(updated);
    const entry = historyEntryFor(next);
    Promise.all([saveStreak(updated), recordHistory(entry)])
      // Finished: drop tonight's rescue nudge and skip today's habit ping.
      .then(() => syncNudges())
      .catch(() => toast.error(t('scout.errorSave')));
    // Share the score-only result with friends — a local queue write plus a
    // fire-and-forget flush; a no-op until the player opts into Friends.
    queueDailyResult(fromScoutEntry(entry, updated.current)).catch(() => {});
  }

  // Give up: reveal the secret and end the day unsolved (breaks the streak).
  function confirmGiveUp() {
    if (!state || isFinished(state)) {
      return;
    }
    Alert.alert(t('scout.giveUpTitle'), t('scout.giveUpMessage'), [
      {text: t('scout.giveUpCancel'), style: 'cancel'},
      {
        text: t('scout.giveUpConfirm'),
        style: 'destructive',
        onPress: () => {
          const next = giveUp(state);
          setState(next);
          saveDailyProgress({
            dateKey,
            guessedIds: next.guesses.map(g => g.footballerId),
            secretId: next.secretId,
            gaveUp: true,
          }).catch(() => toast.error(t('scout.errorSave')));
          haptics.warning();
          finishDay(next, true);
        },
      },
    ]);
  }

  if (!state) {
    return (
      <Screen canvas edges={['left', 'right', 'bottom']}>
        <View style={styles.loading}>
          <Text variant="body" color="secondary">
            {t('scout.loading')}
          </Text>
        </View>
        <FloatingBar edge="top" style={styles.chromeBar}>
          <View style={styles.chromeRow}>
            <CircleButton size={36} accessibilityLabel={t('scout.back')} onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
            </CircleButton>
          </View>
        </FloatingBar>
      </Screen>
    );
  }

  const finished = isFinished(state);
  const won = state.status === 'won';
  const guessesUsed = state.guesses.length;
  // The streak survives when the solve lands within STREAK_GUESS_LIMIT guesses
  // (10 or under); alive = the next guess could still be within the limit.
  const streakStillAlive = guessesUsed < STREAK_GUESS_LIMIT;
  const keptStreak = won && guessesUsed <= STREAK_GUESS_LIMIT;
  const secretPlayer = getById(state.secretId);
  // The answer reveal (shown once finished): flag + crest + position.
  const secretAttrs = secretPlayer
    ? deriveAttributes(secretPlayer, state.dateKey)
    : undefined;
  const secretNation = secretPlayer?.nationality[0];
  const secretClub = secretAttrs?.activeClubId ? getClub(secretAttrs.activeClubId) : undefined;
  const secretFlag = flagImage(secretNation);
  const secretCrest = logoImage(secretAttrs?.activeClubId);
  const secretPosition =
    secretPlayer?.positions.map(p => POSITION_LABELS[p]).join(' · ') ?? '';

  return (
    <Screen canvas edges={['left', 'right', 'bottom']}>
      {/* Lift the guess field above the keyboard while typing. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.body, {paddingTop: insets.top + spacing.sm}]}>
        {/* Wordmark centred full-width; back/history/help float in the corners. */}
        <View style={styles.titleHeader}>
          <Text variant="wordmark" align="center">
            {t('scout.title')}
          </Text>
        </View>

        <Text
          variant="section"
          align="center"
          style={[
            styles.instruction,
            finished && {color: won ? colors.success : colors.error},
          ]}>
          {finished
            ? won
              ? keptStreak
                ? t('scout.won', {count: guessesUsed})
                : t('scout.wonNoStreak', {count: guessesUsed})
              : t('scout.revealedTitle')
            : t('scout.instruction')}
        </Text>
        {!finished ? (
          <Text variant="caption" color="muted" align="center">
            {t('scout.guessCount', {count: guessesUsed})}
          </Text>
        ) : null}
        {/* Streak nudge: a heads-up from guess 7, and once ten are spent the
            streak is gone for today (but the puzzle plays on). */}
        {!finished && guessesUsed >= 6 ? (
          <Text
            variant="caption"
            color="muted"
            align="center"
            style={!streakStillAlive && {color: colors.error}}>
            {streakStillAlive ? t('scout.streakWarning') : t('scout.streakGone')}
          </Text>
        ) : null}

        {/* Colour key — chips inside each card carry the signal now. */}
        <View style={styles.legend}>
          <LegendItem color={colors.guessHit} label={t('scout.legend.match')} />
          <LegendItem color={colors.guessNear} label={t('scout.legend.partial')} />
          <LegendItem color={colors.guessMiss} label={t('scout.legend.off')} />
        </View>

        {/* Column key: labels line up with the chip columns inside every card,
            so each chip (incl. the bare age number) reads unambiguously. */}
        <View style={styles.columnHeader}>
          {COLUMNS.map(key => (
            <Text
              key={key}
              maxFontSizeMultiplier={BOARD_TEXT_SCALE}
              style={styles.columnLabel}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {t(`scout.columns.${key}`)}
            </Text>
          ))}
        </View>

        {/* The guess list dissolves into the canvas at both edges (no
            borders) so cards never bleed into the header or the search pill. */}
        <View style={styles.boardWrap}>
          <ScrollView
            style={styles.board}
            contentContainerStyle={styles.boardContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={fades.onScroll}
            onLayout={fades.onLayout}
            onContentSizeChange={fades.onContentSizeChange}>
            {/* Newest guess first; the badge counts the real guess ordinal. */}
            {state.guesses
              .slice()
              .reverse()
              .map((g, i) => {
                const player = getById(g.footballerId);
                const guessNumber = state.guesses.length - i;
                return (
                  <View key={g.footballerId} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text variant="body" numberOfLines={1} style={styles.cardName}>
                        {player?.name ?? g.footballerId}
                      </Text>
                      <Text variant="caption" style={styles.cardNumber}>
                        {t('scout.guessNumber', {n: guessNumber})}
                      </Text>
                    </View>
                    <View style={styles.chipRow}>
                      {g.cells.map(cell => (
                        <Cell
                          key={cell.key}
                          cell={cell}
                          player={player}
                          dateKey={state.dateKey}
                          onInfo={showCellInfo}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            {state.guesses.length === 0 ? (
              <Text variant="secondary" color="secondary" align="center" style={styles.emptyHint}>
                {t('scout.searchHint')}
              </Text>
            ) : null}
          </ScrollView>
          <EdgeFade edge="top" opacity={fades.topOpacity} />
          <EdgeFade edge="bottom" opacity={fades.bottomOpacity} />
        </View>

        {finished ? (
          <View style={styles.finishPanel}>
            {/* Answer reveal — the payoff. */}
            <View style={styles.answerReveal}>
              <Text variant="caption" color="muted" align="center" style={styles.answerLabel}>
                {t('scout.answerLabel')}
              </Text>
              <Text variant="section" align="center" numberOfLines={1} style={styles.answerName}>
                {secretPlayer?.name ?? '?'}
              </Text>
              <View style={styles.answerMeta}>
                {secretFlag != null && secretNation ? (
                  <Pressable
                    onPress={() => showCellInfo({image: secretFlag, label: secretNation})}
                    accessibilityRole="button"
                    accessibilityLabel={secretNation}>
                    <Image source={secretFlag} resizeMode="contain" style={styles.answerFlag} />
                  </Pressable>
                ) : null}
                {secretCrest != null && secretClub ? (
                  <Pressable
                    onPress={() => showCellInfo({image: secretCrest, label: secretClub.name})}
                    accessibilityRole="button"
                    accessibilityLabel={secretClub.name}>
                    <Image source={secretCrest} resizeMode="contain" style={styles.answerCrest} />
                  </Pressable>
                ) : null}
                {secretPosition ? (
                  <Text variant="secondary" color="secondary">
                    {secretPosition}
                  </Text>
                ) : null}
                {secretAttrs?.age !== undefined ? (
                  <Text variant="secondary" color="secondary">
                    {t('scout.answerAge', {value: secretAttrs.age})}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.streakRow}>
              <Stat label={t('scout.guessesUsed')} value={guessesUsed} />
              <Stat
                label={t('scout.streakCurrent')}
                value={streak.current}
                highlight={keptStreak}
              />
              <Stat label={t('scout.streakBest')} value={streak.best} />
            </View>
            <Countdown />
          </View>
        ) : (
          <View style={styles.inputPanel}>
            <SearchField
              placeholder={t('scout.searchPlaceholder')}
              onPress={openGuessSearch}
            />
            <Pressable
              onPress={confirmGiveUp}
              accessibilityRole="button"
              accessibilityLabel={t('scout.giveUp')}
              hitSlop={8}
              style={styles.giveUp}>
              <Text variant="caption" color="muted">
                {t('scout.giveUp')}
              </Text>
              <Flag size={12} color={colors.muted} strokeWidth={2} />
            </Pressable>
          </View>
        )}
      </View>
      </KeyboardAvoidingView>

      {/* Pinned floating corner buttons (back left, history + help right). */}
      <FloatingBar edge="top" style={styles.chromeBar}>
        <View style={styles.chromeRow}>
          <CircleButton size={36} accessibilityLabel={t('scout.back')} onPress={() => navigation.goBack()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
          <View style={styles.chromeSpacer} />
          <CircleButton size={36} accessibilityLabel={t('scout.help.title')} onPress={() => setShowHelp(true)}>
            <HelpCircle size={18} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        </View>
      </FloatingBar>

      <MysteryHelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
      <CellInfoModal info={cellInfo} onClose={() => setCellInfo(null)} />
    </Screen>
  );
}

/**
 * One feedback cell: coloured by status, showing the guessed player's value.
 * Flag and crest cells are tappable and open [[CellInfoModal]] naming them.
 */
function Cell({
  cell,
  player,
  dateKey,
  onInfo,
}: {
  cell: CellResult;
  player: Footballer | undefined;
  dateKey: string;
  onInfo?: (info: CellInfo) => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const attrs = player ? deriveAttributes(player, dateKey) : undefined;
  const bg = statusBg(colors)[cell.status];
  const arrow = cell.direction === 'up' ? '↑' : cell.direction === 'down' ? '↓' : '';

  let content: React.ReactNode = null;
  let info: CellInfo | null = null;
  if (cell.key === 'nationality') {
    const nation = player?.nationality[0];
    const flag = flagImage(nation);
    if (nation) {
      info = {image: flag ?? null, label: nation};
    }
    content = flag != null ? (
      <Image source={flag} resizeMode="contain" style={styles.cellFlag} />
    ) : (
      <CellText>{nation?.slice(0, 3) ?? '—'}</CellText>
    );
  } else if (cell.key === 'club') {
    const club = attrs?.activeClubId ? getClub(attrs.activeClubId) : undefined;
    const crest = logoImage(attrs?.activeClubId);
    if (club) {
      info = {image: crest ?? null, label: club.name};
    }
    content = crest != null ? (
      <Image source={crest} resizeMode="contain" style={styles.cellLogo} />
    ) : (
      <CellText>—</CellText>
    );
  } else {
    content = <CellText>{`${cellValue(cell.key, attrs)}${arrow}`}</CellText>;
  }

  if (info != null && onInfo) {
    const pressInfo = info;
    return (
      <Pressable
        style={[styles.cell, {backgroundColor: bg}]}
        onPress={() => onInfo(pressInfo)}
        accessibilityRole="button"
        accessibilityLabel={pressInfo.label}>
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.cell, {backgroundColor: bg}]}>{content}</View>;
}

function cellValue(key: ColumnKey, attrs: ReturnType<typeof deriveAttributes> | undefined): string {
  if (!attrs) {
    return '—';
  }
  switch (key) {
    case 'position':
      return attrs.position ?? '—';
    case 'league':
      return leagueShort(attrs.league);
    case 'age':
      return attrs.age !== undefined ? `${attrs.age}` : '—';
    default:
      return '—';
  }
}

/**
 * A chip's text (position, league, age). No `adjustsFontSizeToFit`: on iOS it
 * fights an explicit lineHeight, and the paragraph style wins — the font gets
 * driven down to the shrink floor and the chip reads as a smudge. Everything
 * here is two to seven characters ("MF", "Bundes.", "24↑") and fits at 13 in a
 * chip a fifth of the card wide, so the shrink bought nothing and cost
 * legibility. numberOfLines is the honest fallback if a value ever outgrows it.
 */
function CellText({children}: {children: React.ReactNode}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Text style={styles.cellText} numberOfLines={1}>
      {children}
    </Text>
  );
}

/** One swatch + label in the colour key under the header. */
function LegendItem({color, label}: {color: string; label: string}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, {backgroundColor: color}]} />
      <Text variant="caption" color="muted">
        {label}
      </Text>
    </View>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text variant="stat" style={highlight && styles.statValueHot}>
        {value}
      </Text>
      <Text variant="caption" color="muted">
        {label}
      </Text>
    </View>
  );
}

/** "Come back in" + a live HH:MM:SS to the next daily puzzle (next local midnight). */
function Countdown() {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const d = new Date(now);
  const nextMidnight = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + 1,
    0,
    0,
    0,
    0,
  ).getTime();
  const total = Math.max(0, Math.floor((nextMidnight - now) / 1000));
  const pad = (n: number) => `${n}`.padStart(2, '0');
  const hhmmss = `${pad(Math.floor(total / 3600))}:${pad(
    Math.floor((total % 3600) / 60),
  )}:${pad(total % 60)}`;
  return (
    <View style={styles.countdownWrap}>
      <Text variant="caption" color="muted" align="center">
        {t('scout.comeBackIn')}
      </Text>
      <Text variant="caption" color="muted" align="center" style={styles.countdown}>
        {hhmmss}
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  flex: {flex: 1},
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  // Scroll-away wordmark row + pinned floating corner buttons (canonical chrome).
  titleHeader: {height: 44, alignItems: 'center', justifyContent: 'center'},
  chromeBar: {paddingHorizontal: screenPadding},
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    marginTop: spacing.sm,
  },
  chromeSpacer: {flex: 1},
  body: {flex: 1},
  instruction: {marginBottom: spacing.xs},
  // Colour key under the header.
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: 6},
  legendSwatch: {width: 12, height: 12, borderRadius: 4},
  // Column key, aligned to the chip columns inside every card (same side inset
  // as the card padding + same flex:1 columns + same gap).
  columnHeader: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  columnLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 10,
    letterSpacing: 0.3,
    color: c.muted,
    textAlign: 'center',
  },
  // The list + its two edge-fade scrims.
  boardWrap: {flex: 1},
  board: {flex: 1},
  boardContent: {gap: spacing.md, paddingVertical: spacing.md},
  // One guess = one card (surface fill + hairline rim, no shadow).
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.divider,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  cardTop: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  cardName: {flex: 1, fontFamily: fonts.medium},
  cardNumber: {color: c.textTertiary},
  chipRow: {flexDirection: 'row', gap: 6},
  // Five equal columns on one row (aligns under the column header).
  cell: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    // Its own line box. Text defaults to the body variant, so without this the
    // chip inherits body's lineHeight of 21 around a 13pt glyph, which both
    // mis-centres it in the 36pt chip and is what the old shrink-to-fit was
    // fighting when it collapsed the font.
    lineHeight: 16,
    // White always: the guess chips are fixed bold colours in both themes.
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cellFlag: {width: 22, height: 16, borderRadius: 2},
  cellLogo: {width: 22, height: 22},
  emptyHint: {paddingVertical: spacing.xl},
  finishPanel: {gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm},
  // Answer reveal (the payoff): eyebrow + name + flag · crest · position.
  answerReveal: {alignItems: 'center', gap: spacing.xs},
  answerLabel: {letterSpacing: 1},
  answerName: {color: c.ink},
  answerMeta: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  answerFlag: {width: 24, height: 18, borderRadius: 2},
  answerCrest: {width: 22, height: 22},
  streakRow: {flexDirection: 'row', justifyContent: 'center', gap: spacing.xl},
  stat: {alignItems: 'center', gap: 2},
  statValueHot: {color: c.primary},
  countdownWrap: {alignItems: 'center', gap: 2},
  countdown: {fontVariant: ['tabular-nums'], letterSpacing: 1},
  inputPanel: {gap: spacing.sm, paddingBottom: spacing.sm},
  giveUp: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  });
