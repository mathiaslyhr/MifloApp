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
import {ChevronLeft, Flag, HelpCircle, Lock} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  CircleButton,
  FloatingBar,
  Screen,
  Text,
  TextField,
  toast,
  TopStatusFade,
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
import {FOOTBALLERS, getById, getClub, POSITION_LABELS} from '../data/football';
import {
  enableScoutReminder,
  markScoutReminderOffered,
  shouldOfferScoutReminder,
  syncScoutReminder,
} from '../core/notifications/scoutReminder';
import {flagImage, logoImage} from '../games/hattrick/criterionIcon';
import {searchPlayers} from '../games/hattrick/playerSearch';
import {InlineSuggestions} from '../games/shared/InlineSuggestions';
import {ageOn} from '../games/scout/compare';
import {dateKeyFor} from '../games/scout/dailySeed';
import {dailySecretFor} from '../games/journeyman/dailySeed';
import {
  applyGuess,
  createInitialState,
  EMPTY_STREAK,
  giveUp,
  HINT_ORDER,
  historyEntryFor,
  isFinished,
  recordResult,
  STREAK_GUESS_LIMIT,
  unlockedHints,
} from '../games/journeyman/engine';
import {
  loadDailyProgress,
  loadStreak,
  recordHistory,
  saveDailyProgress,
  saveStreak,
} from '../games/journeyman/storage';
import {syncStreakSaver} from '../core/notifications/streakSaver';
import {queueDailyResult} from '../core/social/outbox';
import {fromJourneymanEntry, liveStreak, ongoingResult} from '../core/social/normalize';
import {JourneymanHelpModal} from '../games/journeyman/JourneymanHelpModal';
import type {
  HintKey,
  JourneymanState,
  StreakState,
} from '../games/journeyman/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Journeyman'>;

export function JourneymanScreen({navigation}: Props) {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const dateKey = useMemo(() => dateKeyFor(new Date()), []);

  const [state, setState] = useState<JourneymanState | null>(null);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [query, setQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  // One-time reminder offer, shown the moment a puzzle is finished — shared
  // with Scout and Top Bins (same asked/pref keys), so whichever daily game
  // the player finishes first gets to ask.
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

  // Rehydrate today's puzzle (replaying stored guesses through the engine) and
  // the streak. No re-recording here — recordResult only runs on a live
  // finish. The secret drawn on first open is pinned so an OTA pack landing
  // mid-day can never swap the puzzle under the player.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [progress, savedStreak] = await Promise.all([
        loadDailyProgress(dateKey),
        loadStreak(),
      ]);
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
          secretId: secret.id,
          guessedIds: progress?.guessedIds ?? [],
          gaveUp: progress?.gaveUp ?? false,
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

  // Inline type-ahead (the Top Bins pattern): top five matches above the
  // field, already-guessed players excluded.
  const suggestions = useMemo(() => {
    if (!state || isFinished(state)) {
      return [];
    }
    return searchPlayers(FOOTBALLERS, query, state.guessedIds, 5).map(f => ({
      key: f.id,
      label: f.name,
      flag: flagImage(f.nationality[0]) ?? undefined,
      position: f.positions[0],
    }));
  }, [query, state]);

  function persist(next: JourneymanState, gaveUpFlag: boolean) {
    saveDailyProgress({
      dateKey,
      secretId: next.secretId,
      guessedIds: next.guessedIds,
      gaveUp: gaveUpFlag,
    }).catch(() => toast.error(t('journeyman.errorSave')));
  }

  function finishDay(next: JourneymanState, gaveUpFlag: boolean) {
    const updated = recordResult(
      streak,
      dateKey,
      next.guessedIds.length,
      gaveUpFlag,
    );
    setStreak(updated);
    const entry = historyEntryFor(next);
    Promise.all([saveStreak(updated), recordHistory(entry)])
      // Finished: drop tonight's rescue nudge and, if the other dailies are
      // done too, skip tomorrow-morning's "new games" ping past today.
      .then(() => Promise.all([syncStreakSaver(), syncScoutReminder()]))
      .catch(() => toast.error(t('journeyman.errorSave')));
    // Share the score-only result with friends — a local queue write plus a
    // fire-and-forget flush; a no-op until the player opts into Friends.
    queueDailyResult(fromJourneymanEntry(entry, updated.current)).catch(() => {});
  }

  function submitGuess(footballerId: string) {
    if (!state || isFinished(state)) {
      return;
    }
    if (state.guessedIds.includes(footballerId)) {
      toast.neutral(t('journeyman.alreadyGuessed'));
      return;
    }
    const next = applyGuess(state, footballerId);
    setState(next);
    setQuery('');
    persist(next, false);
    if (isFinished(next)) {
      haptics.success();
      finishDay(next, false);
    } else {
      haptics.tap();
      // Live "in progress" row for friends: the eye + the running guess
      // count. The finish row replaces it (same day+game key).
      queueDailyResult(
        ongoingResult('journeyman', dateKey, 0, next.guessedIds.length, liveStreak(streak, dateKey)),
      ).catch(() => {});
    }
  }

  function confirmGiveUp() {
    if (!state || isFinished(state)) {
      return;
    }
    Alert.alert(t('journeyman.giveUpTitle'), t('journeyman.giveUpMessage'), [
      {text: t('journeyman.giveUpCancel'), style: 'cancel'},
      {
        text: t('journeyman.giveUpConfirm'),
        style: 'destructive',
        onPress: () => {
          const next = giveUp(state);
          setState(next);
          persist(next, true);
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
            {t('journeyman.loading')}
          </Text>
        </View>
        <FloatingBar edge="top" style={styles.chromeBar}>
          <View style={styles.chromeRow}>
            <CircleButton size={36} accessibilityLabel={t('journeyman.back')} onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
            </CircleButton>
          </View>
        </FloatingBar>
        <TopStatusFade />
      </Screen>
    );
  }

  const finished = isFinished(state);
  const guessesUsed = state.guessedIds.length;
  // The streak survives when the solve lands within STREAK_GUESS_LIMIT guesses
  // (10 or under); alive = the next guess could still be within the limit.
  const streakStillAlive = guessesUsed < STREAK_GUESS_LIMIT;
  const keptStreak = state.status === 'won' && guessesUsed <= STREAK_GUESS_LIMIT;
  const secretPlayer = getById(state.secretId);
  const hints = unlockedHints(state);
  const secretNation = secretPlayer?.nationality[0];
  const secretFlag = flagImage(secretNation);
  const secretPosition =
    secretPlayer?.positions.map(p => POSITION_LABELS[p]).join(' · ') ?? '';
  const secretAge = secretPlayer ? ageOn(dateKey, secretPlayer.born) : undefined;

  function hintValue(key: HintKey): React.ReactNode {
    if (key === 'nationality') {
      return (
        <View style={styles.hintValueRow}>
          {secretFlag != null ? (
            <Image source={secretFlag} resizeMode="contain" style={styles.hintFlag} />
          ) : null}
          <Text variant="secondary" numberOfLines={1} style={styles.hintValueText}>
            {secretNation ?? '?'}
          </Text>
        </View>
      );
    }
    if (key === 'position') {
      return (
        <Text variant="secondary" numberOfLines={1} style={styles.hintValueText}>
          {secretPosition || '?'}
        </Text>
      );
    }
    return (
      <Text variant="secondary" numberOfLines={1} style={styles.hintValueText}>
        {secretAge !== undefined ? `${secretAge}` : '?'}
      </Text>
    );
  }

  return (
    <Screen canvas edges={['left', 'right', 'bottom']}>
      {/* Lift the guess field above the keyboard while typing. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.body, {paddingTop: insets.top + spacing.sm}]}>
        {/* Wordmark centred full-width; back/help float in the corners. */}
        <View style={styles.titleHeader}>
          <Text variant="wordmark" align="center">
            {t('journeyman.title')}
          </Text>
        </View>

        <Text
          variant="section"
          align="center"
          style={[
            styles.instruction,
            finished && state.status === 'won' && {color: colors.success},
          ]}>
          {finished
            ? state.status === 'won'
              ? keptStreak
                ? t('journeyman.won', {count: guessesUsed})
                : t('journeyman.wonNoStreak', {count: guessesUsed})
              : t('journeyman.revealedTitle')
            : t('journeyman.instruction')}
        </Text>
        {!finished ? (
          <Text variant="caption" color="muted" align="center">
            {t('journeyman.guessCount', {count: guessesUsed})}
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
            {streakStillAlive ? t('journeyman.streakWarning') : t('journeyman.streakGone')}
          </Text>
        ) : null}

        <ScrollView
          style={styles.board}
          contentContainerStyle={styles.boardContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {/* The career path — every club spell, oldest first, always visible. */}
          {(secretPlayer?.clubs ?? []).map((spell, index) => {
            const club = getClub(spell.clubId);
            const crest = logoImage(spell.clubId);
            const years =
              spell.from !== undefined
                ? spell.to !== undefined
                  ? t('journeyman.years', {from: spell.from, to: spell.to})
                  : t('journeyman.yearsNow', {from: spell.from})
                : '';
            return (
              <View key={`${spell.clubId}-${index}`} style={styles.spell}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepText}>{index + 1}</Text>
                </View>
                {crest != null ? (
                  <Image source={crest} resizeMode="contain" style={styles.spellCrest} />
                ) : null}
                <Text
                  variant="body"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={styles.spellClub}>
                  {club?.name ?? spell.clubId}
                </Text>
                {spell.loan ? (
                  <View style={styles.loanTag}>
                    <Text variant="caption" color="secondary" style={styles.loanText}>
                      {t('journeyman.loan')}
                    </Text>
                  </View>
                ) : null}
                <Text variant="secondary" color="tertiary" style={styles.spellYears}>
                  {years}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Hint chips: one unlocks per wrong guess, in a fixed order. Hidden
            once the day is over — the answer reveal says it all. */}
        {!finished ? (
          <View style={styles.hintRow}>
            {HINT_ORDER.map(key => {
              const unlocked = hints.includes(key);
              return (
                <View key={key} style={[styles.hintChip, !unlocked && styles.hintChipLocked]}>
                  <Text variant="caption" color="muted" style={styles.hintLabel}>
                    {t(`journeyman.hints.${key}`)}
                  </Text>
                  {unlocked ? (
                    hintValue(key)
                  ) : (
                    <Lock size={14} color={colors.textTertiary} strokeWidth={2} />
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

        {finished ? (
          <View style={styles.finishPanel}>
            {/* Answer reveal — the payoff. */}
            <View style={styles.answerReveal}>
              <Text variant="caption" color="muted" align="center" style={styles.answerLabel}>
                {t('journeyman.answerLabel')}
              </Text>
              <Text variant="section" align="center" numberOfLines={1} style={styles.answerName}>
                {secretPlayer?.name ?? '?'}
              </Text>
              <View style={styles.answerMeta}>
                {secretFlag != null ? (
                  <Image source={secretFlag} resizeMode="contain" style={styles.answerFlag} />
                ) : null}
                {secretPosition ? (
                  <Text variant="secondary" color="secondary">
                    {secretPosition}
                  </Text>
                ) : null}
                {secretAge !== undefined ? (
                  <Text variant="secondary" color="secondary">
                    {t('journeyman.answerAge', {value: secretAge})}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.streakRow}>
              <Stat label={t('journeyman.guessesUsed')} value={guessesUsed} />
              <Stat
                label={t('journeyman.streakCurrent')}
                value={streak.current}
                highlight={keptStreak}
              />
              <Stat label={t('journeyman.streakBest')} value={streak.best} />
            </View>
            <Countdown />
          </View>
        ) : (
          <View style={styles.inputPanel}>
            <InlineSuggestions
              items={suggestions}
              onPick={item => submitGuess(item.key)}
            />
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder={t('journeyman.searchPlaceholder')}
              autoCapitalize="words"
              accessibilityLabel={t('journeyman.searchPlaceholder')}
            />
            <Pressable
              onPress={confirmGiveUp}
              accessibilityRole="button"
              accessibilityLabel={t('journeyman.giveUp')}
              hitSlop={8}
              style={styles.giveUp}>
              <Text variant="caption" color="muted">
                {t('journeyman.giveUp')}
              </Text>
              <Flag size={12} color={colors.muted} strokeWidth={2} />
            </Pressable>
          </View>
        )}
      </View>
      </KeyboardAvoidingView>

      {/* Pinned floating corner buttons (back left, help right). */}
      <FloatingBar edge="top" style={styles.chromeBar}>
        <View style={styles.chromeRow}>
          <CircleButton size={36} accessibilityLabel={t('journeyman.back')} onPress={() => navigation.goBack()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
          <View style={styles.chromeSpacer} />
          <CircleButton size={36} accessibilityLabel={t('journeyman.help.title')} onPress={() => setShowHelp(true)}>
            <HelpCircle size={18} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        </View>
      </FloatingBar>
      <TopStatusFade />

      <JourneymanHelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </Screen>
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
      <Text style={[styles.statValue, highlight && styles.statValueHot]}>
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
        {t('journeyman.comeBackIn')}
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
  board: {flex: 1, marginTop: spacing.md},
  boardContent: {gap: spacing.sm, paddingBottom: spacing.sm},
  // One career step: glass row — step number, crest, club, loan tag, years.
  spell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    backgroundColor: c.glassLight,
    borderWidth: 1,
    borderColor: c.glassRim,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
    borderWidth: 1,
    borderColor: c.glassRim,
  },
  // Explicit tight lineHeight: without it the themed body lineHeight (24)
  // pushes the digit off-centre inside the 26pt circle.
  stepText: {fontFamily: fonts.medium, fontSize: 13, lineHeight: 16, color: c.muted},
  spellCrest: {width: 22, height: 22},
  spellClub: {flex: 1},
  loanTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: c.surface2,
    borderWidth: 1,
    borderColor: c.glassRim,
  },
  loanText: {fontSize: 11, lineHeight: 14},
  spellYears: {fontVariant: ['tabular-nums']},
  // Hint chips: label on top, value (or a lock) underneath.
  hintRow: {flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm},
  hintChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.card,
    backgroundColor: c.glassLight,
    borderWidth: 1,
    borderColor: c.glassRim,
  },
  hintChipLocked: {opacity: 0.55},
  hintLabel: {letterSpacing: 0.3},
  hintValueRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  hintFlag: {width: 20, height: 15, borderRadius: 2},
  hintValueText: {color: c.ink},
  inputPanel: {gap: spacing.xs, paddingBottom: spacing.sm},
  finishPanel: {gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm},
  // Answer reveal (the payoff): eyebrow + name + flag · position · age.
  answerReveal: {alignItems: 'center', gap: spacing.xs},
  answerLabel: {letterSpacing: 1},
  answerName: {color: c.ink},
  answerMeta: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  answerFlag: {width: 24, height: 18, borderRadius: 2},
  streakRow: {flexDirection: 'row', justifyContent: 'center', gap: spacing.xl},
  stat: {alignItems: 'center', gap: 2},
  statValue: {fontFamily: fonts.medium, fontSize: 20, lineHeight: 24, color: c.ink},
  statValueHot: {color: c.primary},
  countdownWrap: {alignItems: 'center', gap: 2},
  countdown: {fontVariant: ['tabular-nums'], letterSpacing: 1},
  giveUp: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  });
