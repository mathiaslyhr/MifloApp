import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeftRight,
  ChevronLeft,
  Footprints,
  HelpCircle,
  Volleyball,
} from 'lucide-react-native';
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
  enableScoutReminder,
  markScoutReminderOffered,
  shouldOfferScoutReminder,
  syncScoutReminder,
} from '../core/notifications/scoutReminder';
import {colors, fonts, radii, screenPadding, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {
  FOOTBALLERS,
  getLineupById,
  type FamousLineup,
  type Footballer,
  type LineupPlayer,
} from '../data/football';
import {flagImage} from '../games/hattrick/criterionIcon';
import {fold, searchPlayers} from '../games/hattrick/playerSearch';
import {dateKeyFor} from '../games/scout/dailySeed';
import {dailyLineupFor} from '../games/teamsheet/dailySeed';
import {
  applyGuess,
  createInitialState,
  EMPTY_STREAK,
  foundSlots,
  giveUp,
  historyEntryFor,
  isFinished,
  matchGuess,
  missCount,
  recordResult,
  STREAK_MISS_LIMIT,
} from '../games/teamsheet/engine';
import {
  loadDailyProgress,
  loadStreak,
  recordHistory,
  saveDailyProgress,
  saveStreak,
} from '../games/teamsheet/storage';
import {syncTeamsheetStreakSaver} from '../games/teamsheet/streakSaver';
import {TeamsheetHelpModal} from '../games/teamsheet/TeamsheetHelpModal';
import type {StreakState, TeamsheetState} from '../games/teamsheet/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Teamsheet'>;

/** "4-2-3-1" -> [1, 4, 2, 3, 1]: the GK row plus one row per formation line.
 * Row order matches the players array (GK first, defence next). */
function formationRows(formation: string): number[] {
  const rows = formation
    .split('-')
    .map(n => parseInt(n, 10))
    .filter(n => Number.isFinite(n) && n > 0);
  return [1, ...rows];
}

/** Short name for a token: the surname, initialled when two players share it. */
function tokenName(lineup: FamousLineup, player: LineupPlayer): string {
  const surnameOf = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts[parts.length - 1];
  };
  const surname = surnameOf(player.name);
  const shared =
    lineup.players.filter(p => surnameOf(p.name) === surname).length > 1;
  return shared && player.name.includes(' ')
    ? `${player.name.trim()[0]}. ${surname}`
    : surname;
}

export function TeamsheetScreen({navigation}: Props) {
  const {t, i18n} = useTranslation();
  const insets = useSafeAreaInsets();
  const dateKey = useMemo(() => dateKeyFor(new Date()), []);

  const [state, setState] = useState<TeamsheetState | null>(null);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // One-time reminder offer, shown the moment a sheet is finished — shared
  // with the other dailies (same asked/pref keys), so whichever game the
  // player finishes first gets to ask.
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

  // Rehydrate today's sheet (replaying stored guess texts, with their tapped
  // targets, through the engine) and the streak. No re-recording here —
  // recordResult only runs on a live finish. The lineup drawn on first open
  // is pinned so an OTA pack landing mid-day can never swap the puzzle.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [progress, savedStreak] = await Promise.all([
        loadDailyProgress(dateKey),
        loadStreak(),
      ]);
      const pinned = progress ? getLineupById(progress.lineupId) : undefined;
      const lineup = pinned ?? dailyLineupFor(dateKey);
      let s = createInitialState(dateKey, lineup.id);
      if (progress) {
        for (const guess of progress.guesses) {
          s = applyGuess(s, lineup, guess.text, guess.target).state;
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
          lineupId: lineup.id,
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

  const lineup = state ? getLineupById(state.lineupId) : undefined;

  function persist(next: TeamsheetState, gaveUpFlag: boolean) {
    saveDailyProgress({
      dateKey,
      lineupId: next.lineupId,
      guesses: next.guesses,
      gaveUp: gaveUpFlag,
    }).catch(() => toast.error(t('teamsheet.errorSave')));
  }

  function finishDay(next: TeamsheetState, gaveUpFlag: boolean) {
    const updated = recordResult(streak, dateKey, missCount(next), gaveUpFlag);
    setStreak(updated);
    Promise.all([saveStreak(updated), recordHistory(historyEntryFor(next))])
      // Finished: drop tonight's rescue nudge and, if the other dailies are
      // done too, skip tomorrow-morning's "new games" ping past today.
      .then(() => Promise.all([syncTeamsheetStreakSaver(), syncScoutReminder()]))
      .catch(() => toast.error(t('teamsheet.errorSave')));
  }

  function toggleSelect(slot: number) {
    if (!state || isFinished(state) || foundSlots(state).has(slot)) {
      return;
    }
    haptics.tap();
    if (selected === slot) {
      setSelected(null);
    } else {
      setSelected(slot);
      inputRef.current?.focus();
    }
  }

  function submitText(text: string) {
    if (!state || !lineup || isFinished(state)) {
      return;
    }
    setInput('');
    const target = selected ?? undefined;
    const {state: next, outcome, slot} = applyGuess(state, lineup, text, target);
    if (outcome === 'already-found') {
      haptics.warning();
      toast.neutral(t('teamsheet.alreadyFound'));
      return;
    }
    if (outcome === 'repeat') {
      if (text.trim().length > 0) {
        haptics.warning();
        toast.neutral(t('teamsheet.alreadyTried'));
      }
      return;
    }
    setState(next);
    persist(next, false);
    if (outcome === 'hit' && slot === selected) {
      setSelected(null);
    }
    if (next.status === 'won') {
      haptics.success();
      finishDay(next, false);
    } else if (outcome === 'hit') {
      haptics.tap();
    } else if (outcome === 'wrong-slot') {
      haptics.error();
      toast.neutral(t('teamsheet.wrongSlotToast'));
    } else {
      haptics.error();
      toast.neutral(t('teamsheet.missToast'));
    }
  }

  function submitGuess() {
    submitText(input);
  }

  /**
   * A tapped suggestion submits the best-matching spelling of that player —
   * display name first, then nicknames/full name — so a correct player never
   * lands as a miss just because the sheet's alias uses another variant.
   */
  function submitSuggestion(player: Footballer) {
    if (!lineup) {
      return;
    }
    const candidates = [player.name, ...(player.nicknames ?? []), player.fullName ?? ''];
    const best = candidates.find(
      c => c.length > 0 && matchGuess(lineup, fold(c)) !== undefined,
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
    Alert.alert(t('teamsheet.giveUpTitle'), t('teamsheet.giveUpMessage'), [
      {text: t('teamsheet.giveUpCancel'), style: 'cancel'},
      {
        text: t('teamsheet.giveUpConfirm'),
        style: 'destructive',
        onPress: () => {
          const next = giveUp(state);
          setState(next);
          setSelected(null);
          persist(next, true);
          haptics.warning();
          finishDay(next, true);
        },
      },
    ]);
  }

  if (!state || !lineup) {
    return (
      <Screen canvas edges={['left', 'right', 'bottom']}>
        <View style={styles.loading}>
          <Text variant="body" color="secondary">
            {t('teamsheet.loading')}
          </Text>
        </View>
        <FloatingBar edge="top" style={styles.chromeBar}>
          <View style={styles.chromeRow}>
            <CircleButton size={36} accessibilityLabel={t('teamsheet.back')} onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
            </CircleButton>
          </View>
        </FloatingBar>
        <TopStatusFade />
      </Screen>
    );
  }

  const finished = isFinished(state);
  const found = foundSlots(state);
  const misses = missCount(state);
  const keptStreak = state.status === 'won' && misses <= STREAK_MISS_LIMIT;
  const streakStillAlive = misses <= STREAK_MISS_LIMIT;

  // "World Cup Final 2018" from the competition key, falling back to the raw
  // legacy string for keys this binary's i18n doesn't know yet (OTA content).
  const match = lineup.match;
  const compI18nKey = match ? `teamsheet.competitions.${match.competitionKey}` : '';
  const competitionLine =
    match && i18n.exists(compI18nKey)
      ? t(compI18nKey, {year: lineup.year})
      : `${lineup.competition} ${lineup.year}`;
  const scoreLine = match
    ? `${lineup.team} ${match.goalsFor}–${match.goalsAgainst} ${match.opponent}` +
      (match.pensFor !== undefined
        ? ` · ${t('teamsheet.pens', {for: match.pensFor, against: match.pensAgainst})}`
        : match.afterExtraTime
          ? ` · ${t('teamsheet.aet')}`
          : '')
    : lineup.team;

  const rows = formationRows(lineup.formation);
  let nextSlot = 0;

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
              {t('teamsheet.title')}
            </Text>
          </View>

          <Text
            variant="section"
            align="center"
            style={[styles.matchTitle, finished && state.status === 'won' && {color: colors.success}]}>
            {finished
              ? state.status === 'won'
                ? keptStreak
                  ? t('teamsheet.won')
                  : t('teamsheet.wonNoStreak')
                : t('teamsheet.revealedTitle')
              : competitionLine}
          </Text>
          {/* While playing the score sets the scene; once finished the match
              line moves down here so the payoff line can take over. */}
          <Text variant="caption" color="muted" align="center">
            {finished ? `${competitionLine} · ${scoreLine}` : scoreLine}
          </Text>
          {!finished ? (
            <Text variant="caption" color="muted" align="center">
              {`${t('teamsheet.progress', {found: found.size})} · ${t('teamsheet.missCount', {count: misses})}`}
            </Text>
          ) : null}
          {!finished && misses >= STREAK_MISS_LIMIT - 1 ? (
            <Text
              variant="caption"
              color="muted"
              align="center"
              style={!streakStillAlive && {color: colors.error}}>
              {streakStillAlive ? t('teamsheet.streakWarning') : t('teamsheet.streakGone')}
            </Text>
          ) : null}

          <ScrollView
            style={styles.board}
            contentContainerStyle={styles.boardContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            showsVerticalScrollIndicator={false}>
            {rows.map((count, rowIdx) => {
              const start = nextSlot;
              nextSlot += count;
              return (
                <View key={rowIdx} style={styles.formationRow}>
                  {lineup.players.slice(start, start + count).map((player, i) => {
                    const slot = start + i;
                    return (
                      <PlayerToken
                        key={slot}
                        lineup={lineup}
                        player={player}
                        earned={found.has(slot)}
                        shown={found.has(slot) || finished}
                        selectedToken={selected === slot}
                        onPress={() => toggleSelect(slot)}
                      />
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          {finished ? (
            <View style={styles.finishPanel}>
              <View style={styles.streakRow}>
                <Stat label={t('teamsheet.misses')} value={misses} />
                <Stat
                  label={t('teamsheet.streakCurrent')}
                  value={streak.current}
                  highlight={keptStreak}
                />
                <Stat label={t('teamsheet.streakBest')} value={streak.best} />
              </View>
              <Countdown />
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
                          <Image source={flag} resizeMode="contain" style={styles.suggestionFlag} />
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
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                placeholder={
                  selected !== null
                    ? t('teamsheet.targetPlaceholder', {
                        shirt: lineup.players[selected].shirt,
                      })
                    : t('teamsheet.inputPlaceholder')
                }
                autoCapitalize="words"
                returnKeyType="go"
                submitBehavior="submit"
                onSubmitEditing={submitGuess}
                accessibilityLabel={t('teamsheet.inputPlaceholder')}
              />
              <Pressable
                onPress={confirmGiveUp}
                accessibilityRole="button"
                accessibilityLabel={t('teamsheet.giveUp')}
                hitSlop={8}
                style={styles.giveUp}>
                <Text variant="caption" color="muted">
                  {t('teamsheet.giveUp')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Pinned floating corner buttons (back left, help right). */}
      <FloatingBar edge="top" style={styles.chromeBar}>
        <View style={styles.chromeRow}>
          <CircleButton size={36} accessibilityLabel={t('teamsheet.back')} onPress={() => navigation.goBack()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
          <View style={styles.chromeSpacer} />
          <CircleButton size={36} accessibilityLabel={t('teamsheet.help.title')} onPress={() => setShowHelp(true)}>
            <HelpCircle size={18} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        </View>
      </FloatingBar>
      <TopStatusFade />

      <TeamsheetHelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </Screen>
  );
}

/**
 * One spot on the formation board: a circle with the shirt number where a
 * broadcast graphic would put the face, the name underneath once found, and
 * mini clue badges overlaid on the circle rim — ball(s) for goals, a boot
 * for an assist, C for the captain, swap arrows when they were subbed off.
 * Every token is the same fixed size so all formation lines look identical.
 * Tapping an unfound token targets it (strict positional mode).
 */
function PlayerToken({
  lineup,
  player,
  earned,
  shown,
  selectedToken,
  onPress,
}: {
  lineup: FamousLineup;
  player: LineupPlayer;
  earned: boolean;
  shown: boolean;
  selectedToken: boolean;
  onPress: () => void;
}) {
  const goals = player.goals ?? 0;
  const assists = player.assists ?? 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={shown}
      accessibilityRole="button"
      accessibilityLabel={`${player.shirt}`}
      style={styles.token}>
      <View
        style={[
          styles.circle,
          selectedToken && styles.circleSelected,
          earned && styles.circleEarned,
        ]}>
        <Text style={[styles.shirtText, earned && styles.shirtTextEarned]}>
          {player.shirt}
        </Text>
        {player.subbedOff ? (
          <View style={[styles.badge, styles.badgeTopLeft]}>
            <ArrowLeftRight size={9} color={colors.muted} strokeWidth={2.25} />
          </View>
        ) : null}
        {player.captain ? (
          <View style={[styles.badge, styles.badgeTopRight]}>
            <Text style={styles.captainText}>C</Text>
          </View>
        ) : null}
        {goals > 0 ? (
          <View style={[styles.badge, styles.badgeBottomLeft, goals > 1 && styles.badgeWide]}>
            <Volleyball size={9} color={colors.ink} strokeWidth={2.25} />
            {goals > 1 ? <Text style={styles.badgeCount}>{goals}</Text> : null}
          </View>
        ) : null}
        {assists > 0 ? (
          <View style={[styles.badge, styles.badgeBottomRight, assists > 1 && styles.badgeWide]}>
            <Footprints size={9} color={colors.muted} strokeWidth={2.25} />
            {assists > 1 ? <Text style={styles.badgeCount}>{assists}</Text> : null}
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={[styles.tokenName, !earned && shown && styles.tokenNameRevealed]}>
        {shown ? tokenName(lineup, player) : ' '}
      </Text>
    </Pressable>
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

/** "Come back in" + a live HH:MM:SS to the next daily sheet (next local midnight). */
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
        {t('teamsheet.comeBackIn')}
      </Text>
      <Text variant="caption" color="muted" align="center" style={styles.countdown}>
        {hhmmss}
      </Text>
    </View>
  );
}

const TOKEN_WIDTH = 62;
const CIRCLE = 50;
const BADGE = 16;

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
  matchTitle: {marginBottom: spacing.xs},
  board: {flex: 1, marginTop: spacing.md},
  boardContent: {gap: spacing.md, paddingBottom: spacing.sm},
  // One formation line: GK alone up top, then defence down to attack. Fixed
  // token sizes and centred rows keep 1/2/3/4/5-man lines visually identical.
  formationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  token: {width: TOKEN_WIDTH, alignItems: 'center', gap: 3},
  // The player circle: shirt number where the face would be. Glass while
  // hidden, brand purple once earned, primary ring while targeted.
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassLight,
    borderWidth: 2,
    borderColor: colors.glassRim,
  },
  circleSelected: {borderColor: colors.primary},
  circleEarned: {backgroundColor: colors.primary, borderColor: colors.primary},
  // Explicit tight lineHeight: without it the themed lineHeight pushes the
  // digits off-centre inside the circle.
  shirtText: {
    fontFamily: fonts.medium,
    fontSize: 18,
    lineHeight: 22,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  shirtTextEarned: {color: colors.onInk},
  // Mini clue badges pinned to the circle rim (screenshot layout): swap
  // arrows top-left, armband top-right, goals bottom-left, assist bottom-right.
  badge: {
    position: 'absolute',
    minWidth: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassRim,
  },
  badgeWide: {paddingHorizontal: 3},
  badgeTopLeft: {top: -3, left: -3},
  badgeTopRight: {top: -3, right: -3},
  badgeBottomLeft: {bottom: -3, left: -3},
  badgeBottomRight: {bottom: -3, right: -3},
  badgeCount: {
    fontFamily: fonts.medium,
    fontSize: 8,
    lineHeight: 10,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  captainText: {
    fontFamily: fonts.medium,
    fontSize: 8,
    lineHeight: 10,
    color: colors.muted,
  },
  tokenName: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 13,
    color: colors.ink,
    textAlign: 'center',
    maxWidth: TOKEN_WIDTH + 6,
  },
  tokenNameRevealed: {color: colors.textTertiary},
  inputPanel: {gap: spacing.sm, paddingBottom: spacing.sm},
  // Type-ahead card floating above the field: whole-dataset search, so it
  // helps spelling without leaking who is on today's sheet.
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
  suggestionFlag: {width: 22, height: 16, borderRadius: 2},
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
