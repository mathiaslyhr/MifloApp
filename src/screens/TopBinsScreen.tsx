import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import {ChevronLeft, HelpCircle} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Button,
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
  enableScoutReminder,
  markScoutReminderOffered,
  shouldOfferScoutReminder,
  syncScoutReminder,
} from '../core/notifications/scoutReminder';
import {colors, fonts, radii, screenPadding, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {FOOTBALLERS, getById, type Footballer} from '../data/football';
import {flagImage} from '../games/hattrick/criterionIcon';
import {fold, searchPlayers} from '../games/hattrick/playerSearch';
import {dateKeyFor} from '../games/scout/dailySeed';
import {dailyListFor} from '../games/tenball/dailyList';
import {
  applyGuess,
  createInitialState,
  EMPTY_STREAK,
  foundRanks,
  giveUp,
  historyEntryFor,
  isFinished,
  matchGuess,
  missCount,
  recordResult,
  STREAK_MISS_LIMIT,
} from '../games/tenball/engine';
import {getListById} from '../games/tenball/lists';
import {buildShareText} from '../games/tenball/share';
import {
  loadDailyProgress,
  loadStreak,
  recordHistory,
  saveDailyProgress,
  saveStreak,
} from '../games/tenball/storage';
import {syncTenballStreakSaver} from '../games/tenball/streakSaver';
import {TenballHelpModal} from '../games/tenball/TenballHelpModal';
import type {StreakState, TenballState} from '../games/tenball/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TopBins'>;

export function TopBinsScreen({navigation}: Props) {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const dateKey = useMemo(() => dateKeyFor(new Date()), []);

  const [state, setState] = useState<TenballState | null>(null);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [input, setInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const boardRef = useRef<ScrollView>(null);
  const slotYs = useRef<Record<number, number>>({});

  // One-time reminder offer, shown the moment a board is finished — shared
  // with Scout (same asked/pref keys), so whichever daily game the player
  // finishes first gets to ask.
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

  // Rehydrate today's board (replaying stored guess texts through the engine)
  // and the streak. No re-recording here — recordResult only runs on a live
  // finish. The list drawn on first open is pinned so an OTA pack landing
  // mid-day can never swap the puzzle under the player.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [progress, savedStreak] = await Promise.all([
        loadDailyProgress(dateKey),
        loadStreak(),
      ]);
      const pinned = progress ? getListById(progress.listId) : undefined;
      const list = pinned ?? dailyListFor(dateKey);
      let s = createInitialState(dateKey, list.id);
      if (progress) {
        for (const guess of progress.guesses) {
          s = applyGuess(s, list, guess.text).state;
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
          listId: list.id,
          guesses: progress?.guesses ?? [],
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

  const list = state ? getListById(state.listId) : undefined;

  function persist(next: TenballState, gaveUpFlag: boolean) {
    saveDailyProgress({
      dateKey,
      listId: next.listId,
      guesses: next.guesses,
      gaveUp: gaveUpFlag,
    }).catch(() => toast.error(t('tenball.errorSave')));
  }

  function finishDay(next: TenballState, gaveUpFlag: boolean) {
    const updated = recordResult(streak, dateKey, missCount(next), gaveUpFlag);
    setStreak(updated);
    Promise.all([saveStreak(updated), recordHistory(historyEntryFor(next))])
      // Finished: drop tonight's rescue nudge and, if Scout is done too,
      // skip tomorrow-morning's "new games" ping past today.
      .then(() => Promise.all([syncTenballStreakSaver(), syncScoutReminder()]))
      .catch(() => toast.error(t('tenball.errorSave')));
  }

  function submitText(text: string) {
    if (!state || !list || isFinished(state)) {
      return;
    }
    setInput('');
    const {state: next, outcome} = applyGuess(state, list, text);
    if (outcome === 'already-found') {
      haptics.warning();
      toast.neutral(t('tenball.alreadyFound'));
      return;
    }
    if (outcome === 'repeat') {
      if (text.trim().length > 0) {
        haptics.warning();
        toast.neutral(t('tenball.alreadyTried'));
      }
      return;
    }
    setState(next);
    persist(next, false);
    if (outcome === 'hit') {
      // Bring the slot the guess just filled into view — rank 10 lives below
      // the fold, and seeing the row flip IS the payoff.
      const rank = next.guesses[next.guesses.length - 1]?.rank;
      if (rank !== undefined) {
        requestAnimationFrame(() => {
          boardRef.current?.scrollTo({
            y: Math.max(0, (slotYs.current[rank] ?? 0) - 96),
            animated: true,
          });
        });
      }
    }
    if (next.status === 'won') {
      haptics.success();
      finishDay(next, false);
    } else if (outcome === 'hit') {
      haptics.tap();
    } else {
      haptics.error();
      toast.neutral(t('tenball.missToast'));
    }
  }

  function submitGuess() {
    submitText(input);
  }

  /**
   * A tapped suggestion submits the best-matching spelling of that player —
   * display name first, then nicknames/full name — so a correct player never
   * lands as a miss just because the list's alias uses another variant.
   */
  function submitSuggestion(player: Footballer) {
    if (!list) {
      return;
    }
    const candidates = [player.name, ...(player.nicknames ?? []), player.fullName ?? ''];
    const best = candidates.find(
      c => c.length > 0 && matchGuess(list, fold(c)) !== undefined,
    );
    submitText(best ?? player.name);
  }

  const suggestions = useMemo(() => {
    if (!state || isFinished(state) || input.trim().length === 0) {
      return [];
    }
    return searchPlayers(FOOTBALLERS, input, [], 5);
  }, [input, state]);

  function confirmGiveUp() {
    if (!state || isFinished(state)) {
      return;
    }
    Alert.alert(t('tenball.giveUpTitle'), t('tenball.giveUpMessage'), [
      {text: t('tenball.giveUpCancel'), style: 'cancel'},
      {
        text: t('tenball.giveUpConfirm'),
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

  function shareResult() {
    if (!state || !isFinished(state)) {
      return;
    }
    Share.share({message: `${buildShareText(state)}\n${t('tenball.shareCaption')}`}).catch(
      () => {},
    );
  }

  if (!state || !list) {
    return (
      <Screen canvas edges={['left', 'right', 'bottom']}>
        <View style={styles.loading}>
          <Text variant="body" color="secondary">
            {t('tenball.loading')}
          </Text>
        </View>
        <FloatingBar edge="top" style={styles.chromeBar}>
          <View style={styles.chromeRow}>
            <CircleButton size={36} accessibilityLabel={t('tenball.back')} onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
            </CircleButton>
          </View>
        </FloatingBar>
        <TopStatusFade />
      </Screen>
    );
  }

  const finished = isFinished(state);
  const found = foundRanks(state);
  const misses = missCount(state);
  const keptStreak = state.status === 'won' && misses <= STREAK_MISS_LIMIT;
  const streakStillAlive = misses <= STREAK_MISS_LIMIT;

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
              {t('tenball.title')}
            </Text>
          </View>

          <Text
            variant="section"
            align="center"
            style={[styles.listTitle, finished && state.status === 'won' && {color: colors.success}]}>
            {finished
              ? state.status === 'won'
                ? keptStreak
                  ? t('tenball.won')
                  : t('tenball.wonNoStreak')
                : t('tenball.revealedTitle')
              : t(`tenball.lists.${state.listId}.title`)}
          </Text>
          {/* While playing the counter carries the score; once finished the
              list title moves down here so the payoff line can take over. */}
          <Text variant="caption" color="muted" align="center">
            {finished
              ? t(`tenball.lists.${state.listId}.title`)
              : `${t('tenball.progress', {found: found.size})} · ${t('tenball.missCount', {count: misses})}`}
          </Text>
          {!finished && misses >= 7 ? (
            <Text
              variant="caption"
              color="muted"
              align="center"
              style={!streakStillAlive && {color: colors.error}}>
              {streakStillAlive ? t('tenball.streakWarning') : t('tenball.streakGone')}
            </Text>
          ) : null}

          <ScrollView
            ref={boardRef}
            style={styles.board}
            contentContainerStyle={styles.boardContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}>
            {list.entries.map(entry => {
              const earned = found.has(entry.rank);
              const shown = earned || finished;
              const flag = entry.footballerId
                ? flagImage(getById(entry.footballerId)?.nationality[0])
                : undefined;
              return (
                <View
                  key={entry.rank}
                  onLayout={e => {
                    slotYs.current[entry.rank] = e.nativeEvent.layout.y;
                  }}
                  style={[styles.slot, shown && !earned && styles.slotRevealed]}>
                  <View style={[styles.rankBadge, earned && styles.rankBadgeEarned]}>
                    <Text style={[styles.rankText, earned && styles.rankTextEarned]}>
                      {entry.rank}
                    </Text>
                  </View>
                  {shown ? (
                    <>
                      {flag != null ? (
                        <Image source={flag} resizeMode="contain" style={styles.slotFlag} />
                      ) : null}
                      <Text
                        variant="body"
                        numberOfLines={1}
                        style={[styles.slotName, !earned && styles.slotNameRevealed]}>
                        {entry.name}
                      </Text>
                      <Text variant="secondary" color={earned ? 'primary' : 'tertiary'}>
                        {entry.value}
                      </Text>
                    </>
                  ) : (
                    <View style={styles.slotBlank} />
                  )}
                </View>
              );
            })}
          </ScrollView>

          {finished ? (
            <View style={styles.finishPanel}>
              <View style={styles.streakRow}>
                <Stat label={t('tenball.misses')} value={misses} />
                <Stat
                  label={t('tenball.streakCurrent')}
                  value={streak.current}
                  highlight={keptStreak}
                />
                <Stat label={t('tenball.streakBest')} value={streak.best} />
              </View>
              <Countdown />
              <Button label={t('tenball.share')} onPress={shareResult} />
            </View>
          ) : (
            <View style={styles.inputPanel}>
              {suggestions.length > 0 ? (
                <View style={styles.suggestions}>
                  {suggestions.map(f => {
                    const flag = flagImage(f.nationality[0]);
                    return (
                      <Pressable
                        key={f.id}
                        style={styles.suggestionRow}
                        onPress={() => submitSuggestion(f)}
                        accessibilityRole="button"
                        accessibilityLabel={f.name}>
                        {flag != null ? (
                          <Image source={flag} resizeMode="contain" style={styles.slotFlag} />
                        ) : null}
                        <Text variant="body" numberOfLines={1} style={styles.suggestionName}>
                          {f.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <TextField
                value={input}
                onChangeText={setInput}
                placeholder={t('tenball.inputPlaceholder')}
                autoCapitalize="words"
                autoFocus
                returnKeyType="go"
                submitBehavior="submit"
                onSubmitEditing={submitGuess}
                accessibilityLabel={t('tenball.inputPlaceholder')}
              />
              <Pressable
                onPress={confirmGiveUp}
                accessibilityRole="button"
                accessibilityLabel={t('tenball.giveUp')}
                hitSlop={8}
                style={styles.giveUp}>
                <Text variant="caption" color="muted">
                  {t('tenball.giveUp')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Pinned floating corner buttons (back left, help right). */}
      <FloatingBar edge="top" style={styles.chromeBar}>
        <View style={styles.chromeRow}>
          <CircleButton size={36} accessibilityLabel={t('tenball.back')} onPress={() => navigation.goBack()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
          <View style={styles.chromeSpacer} />
          <CircleButton size={36} accessibilityLabel={t('tenball.help.title')} onPress={() => setShowHelp(true)}>
            <HelpCircle size={18} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        </View>
      </FloatingBar>
      <TopStatusFade />

      <TenballHelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
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

/** "Come back in" + a live HH:MM:SS to the next daily list (next local midnight). */
function Countdown() {
  const {t} = useTranslation();
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
        {t('tenball.comeBackIn')}
      </Text>
      <Text variant="caption" color="muted" align="center" style={styles.countdown}>
        {hhmmss}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  listTitle: {marginBottom: spacing.xs},
  board: {flex: 1, marginTop: spacing.md},
  boardContent: {gap: spacing.sm, paddingBottom: spacing.sm},
  // One rank slot: glass row, blank while hidden, name + value once shown.
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.glassRim,
  },
  // Slots exposed by giving up read as "shown, not earned".
  slotRevealed: {opacity: 0.55},
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.glassRim,
  },
  rankBadgeEarned: {backgroundColor: colors.primary, borderColor: colors.primary},
  // Explicit tight lineHeight: without it the themed body lineHeight (24)
  // pushes the digit off-centre inside the 26pt circle.
  rankText: {fontFamily: fonts.medium, fontSize: 13, lineHeight: 16, color: colors.muted},
  rankTextEarned: {color: colors.onInk},
  slotFlag: {width: 22, height: 16, borderRadius: 2},
  slotName: {flex: 1},
  slotNameRevealed: {color: colors.textSecondary},
  slotBlank: {flex: 1},
  inputPanel: {gap: spacing.sm, paddingBottom: spacing.sm},
  // Type-ahead card floating above the field: whole-dataset search, so it
  // helps spelling without leaking who is on today's list.
  suggestions: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.glassRim,
    paddingHorizontal: spacing.md,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  suggestionName: {flex: 1},
  giveUp: {alignSelf: 'center', paddingVertical: spacing.xs},
  finishPanel: {gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm},
  streakRow: {flexDirection: 'row', justifyContent: 'center', gap: spacing.xl},
  stat: {alignItems: 'center', gap: 2},
  statValue: {fontFamily: fonts.medium, fontSize: 20, lineHeight: 24, color: colors.ink},
  statValueHot: {color: colors.primary},
  countdownWrap: {alignItems: 'center', gap: 2},
  countdown: {fontVariant: ['tabular-nums'], letterSpacing: 1},
});
