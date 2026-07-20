import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ArrowLeftRight,
  ChevronLeft,
  Flag,
  Footprints,
  HelpCircle,
  Volleyball,
} from 'lucide-react-native';
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
  enableScoutReminder,
  markScoutReminderOffered,
  shouldOfferScoutReminder,
  syncNudges,
} from '../core/notifications/scoutReminder';
import {
  fonts,
  onRim,
  screenPadding,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {
  getById,
  getLineupById,
  type FamousLineup,
  type Footballer,
  type LineupPlayer,
} from '../data/football';
import {fold} from '../games/hattrick/playerSearch';
import {SearchField, useSearch} from '../games/shared/SearchScreen';
import {playerSource} from '../games/shared/searchSources';
import {dateKeyFor} from '../games/scout/dailySeed';
import {dailyLineupFor} from '../games/teamsheet/dailySeed';
import {formationRows, positionLabels} from '../games/teamsheet/positions';
import {PitchMarkings} from '../games/teamsheet/PitchMarkings';
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
import {queueDailyResult} from '../core/social/outbox';
import {fromTeamsheetEntry, liveStreak, ongoingResult} from '../core/social/normalize';
import {TeamsheetHelpModal} from '../games/teamsheet/TeamsheetHelpModal';
import type {StreakState, TeamsheetState} from '../games/teamsheet/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Teamsheet'>;

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
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const dateKey = useMemo(() => dateKeyFor(new Date()), []);

  const [state, setState] = useState<TeamsheetState | null>(null);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [selected, setSelected] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const openSearch = useSearch();

  const fades = useEdgeFades();

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
  // recordResult only runs on a live finish. The schedule is the single
  // source of today's lineup: stored progress only counts when it belongs to
  // that lineup, so if the day's assignment ever changes (a new schedule or
  // pack), the day restarts fresh instead of replaying guesses against the
  // wrong XI. The frozen schedule keeps this from ever firing in normal use.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [progress, savedStreak] = await Promise.all([
        loadDailyProgress(dateKey),
        loadStreak(),
      ]);
      const lineup = dailyLineupFor(dateKey);
      const usable = progress?.lineupId === lineup.id ? progress : null;
      let s = createInitialState(dateKey, lineup.id);
      if (usable) {
        for (const guess of usable.guesses) {
          s = applyGuess(s, lineup, guess.text, guess.target).state;
        }
        if (usable.gaveUp) {
          s = giveUp(s);
        }
      } else {
        // Fresh day (or a stale lineup's progress being discarded). Silent on
        // failure — a failed save only matters once a guess follows, and that
        // save warns on its own.
        saveDailyProgress({
          dateKey,
          lineupId: lineup.id,
          guesses: [],
          gaveUp: false,
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
    const entry = historyEntryFor(next);
    Promise.all([saveStreak(updated), recordHistory(entry)])
      // Finished: drop tonight's rescue nudge and, if the other dailies
      // are done too, skip today's habit ping.
      .then(() => syncNudges())
      .catch(() => toast.error(t('teamsheet.errorSave')));
    // Share the score-only result with friends — a local queue write plus a
    // fire-and-forget flush; a no-op until the player opts into Friends.
    queueDailyResult(fromTeamsheetEntry(entry, updated.current)).catch(() => {});
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
    }
  }

  function submitText(text: string) {
    if (!state || !lineup || isFinished(state)) {
      return;
    }
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
    if (outcome === 'hit' && slot !== undefined) {
      // Name the player just placed — the token only shows the surname, so
      // the toast confirms exactly who landed.
      toast.success(t('teamsheet.hitToast', {name: lineup.players[slot].name}));
    }
    if (next.status === 'won') {
      haptics.success();
      finishDay(next, false);
    } else {
      // Live "in progress" row for friends: the eye + the running miss
      // count. The finish row replaces it (same day+game key).
      queueDailyResult(
        ongoingResult(
          'teamsheet',
          dateKey,
          foundSlots(next).size,
          missCount(next),
          liveStreak(streak, dateKey),
        ),
      ).catch(() => {});
      if (outcome === 'hit') {
        haptics.tap();
      } else if (outcome === 'wrong-slot') {
        haptics.error();
        toast.neutral(t('teamsheet.wrongSlotToast'));
      } else {
        haptics.error();
        toast.neutral(t('teamsheet.missToast'));
      }
    }
  }

  function openGuessSearch() {
    if (!state || !lineup || isFinished(state)) {
      return;
    }
    const placeholder =
      selected !== null
        ? t('teamsheet.targetPlaceholder', {shirt: lineup.players[selected].shirt})
        : t('teamsheet.inputPlaceholder');
    openSearch(playerSource(), {placeholder}).then(item => {
      if (item) {
        const player = getById(item.id);
        if (player) {
          submitSuggestion(player);
        }
      }
    });
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
  const scoreTail = match
    ? ` - ${match.goalsAgainst} ${match.opponent}` +
      (match.pensFor !== undefined
        ? ` · ${t('teamsheet.pens', {for: match.pensFor, against: match.pensAgainst})}`
        : match.afterExtraTime
          ? ` · ${t('teamsheet.aet')}`
          : '')
    : '';

  const rows = formationRows(lineup.formation);
  const labels = positionLabels(lineup.formation);
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

          {/* Match on one line, the score on the line under it. Winning swaps
              the title for the payoff banner and drops the competition to a
              caption; a reveal keeps the match itself as the title. */}
          <Text
            variant="section"
            align="center"
            style={[styles.matchTitle, finished && state.status === 'won' && {color: colors.success}]}>
            {finished && state.status === 'won'
              ? keptStreak
                ? t('teamsheet.won')
                : t('teamsheet.wonNoStreak')
              : competitionLine}
          </Text>
          {finished && state.status === 'won' ? (
            <Text variant="caption" color="muted" align="center">
              {competitionLine}
            </Text>
          ) : null}
          <Text variant="caption" color="muted" align="center">
            <Text variant="caption" style={styles.scoreTeam}>
              {match ? `${lineup.team} ${match.goalsFor}` : lineup.team}
            </Text>
            {scoreTail}
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

          {/* The board dissolves into the canvas at both edges (no
              borders) so rows never bleed into the header or the search pill. */}
          <View style={styles.boardWrap}>
          <ScrollView
            style={styles.board}
            contentContainerStyle={styles.boardContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={fades.onScroll}
            onLayout={fades.onLayout}
            onContentSizeChange={fades.onContentSizeChange}>
            {/* Tapping the pitch background clears the targeted spot. The
                rows render attack first and GK last, broadcast style. */}
            <Pressable onPress={() => setSelected(null)} style={styles.pitch}>
            <PitchMarkings />
            {rows
              .map(count => {
                const start = nextSlot;
                nextSlot += count;
                return {start, count};
              })
              .reverse()
              .map(({start, count}) => (
                <View
                  key={start}
                  style={[styles.formationRow, count >= 5 && styles.formationRowTight]}>
                  {lineup.players.slice(start, start + count).map((player, i) => {
                    const slot = start + i;
                    return (
                      <PlayerToken
                        key={slot}
                        lineup={lineup}
                        player={player}
                        label={labels[slot]}
                        isGk={slot === 0}
                        tight={count >= 5}
                        earned={found.has(slot)}
                        shown={found.has(slot) || finished}
                        selectedToken={selected === slot}
                        onPress={() => toggleSelect(slot)}
                      />
                    );
                  })}
                </View>
              ))}
            </Pressable>
          </ScrollView>
            <EdgeFade edge="top" opacity={fades.topOpacity} />
            <EdgeFade edge="bottom" opacity={fades.bottomOpacity} />
          </View>

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
              <SearchField
                placeholder={
                  selected !== null
                    ? t('teamsheet.targetPlaceholder', {
                        shirt: lineup.players[selected].shirt,
                      })
                    : t('teamsheet.inputPlaceholder')
                }
                onPress={openGuessSearch}
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
                <Flag size={12} color={colors.muted} strokeWidth={2} />
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

      <TeamsheetHelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </Screen>
  );
}

/**
 * One spot on the formation board: a circle with the shirt number where a
 * broadcast graphic would put the face, the name underneath once found, and
 * mini clue badges overlaid on the circle rim — ball(s) for goals, a boot
 * for an assist, C for the captain, swap arrows when they were subbed off,
 * and a yellow/red card when they were booked or sent off.
 * Every token is the same fixed size so all formation lines look identical.
 * Tapping an unfound token targets it (strict positional mode).
 */
/** Keepers wear their own shirt; a neutral dark stands in until a lineup
 * carries a curated `gkBody`. */
const GK_NEUTRAL = {body: '#4B5563', number: '#F4F4F6'};

function PlayerToken({
  lineup,
  player,
  label,
  isGk,
  tight,
  earned,
  shown,
  selectedToken,
  onPress,
}: {
  lineup: FamousLineup;
  player: LineupPlayer;
  label: string;
  isGk: boolean;
  tight: boolean;
  earned: boolean;
  shown: boolean;
  selectedToken: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const goals = player.goals ?? 0;
  const assists = player.assists ?? 0;
  // The circle wears the shirt this team wore that day; lineups without a
  // curated kit keep the brand-purple fill.
  const kit = lineup.kit;
  const shirtBody = kit ? (isGk ? kit.gkBody ?? GK_NEUTRAL.body : kit.body) : undefined;
  const shirtNumber = kit
    ? isGk
      ? kit.gkNumber ?? GK_NEUTRAL.number
      : kit.number
    : undefined;
  return (
    <Pressable
      onPress={onPress}
      disabled={shown}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${player.shirt}`}
      style={[styles.token, tight && styles.tokenTight]}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
        maxFontSizeMultiplier={BOARD_TEXT_SCALE}
        style={[
          styles.tokenName,
          tight && styles.tokenNameTight,
          !earned && shown && styles.tokenNameRevealed,
        ]}>
        {shown ? tokenName(lineup, player) : ' '}
      </Text>
      <View
        style={[
          styles.circle,
          shirtBody != null && {borderColor: shirtBody},
          shown && [
            styles.circleEarned,
            shirtBody != null && {backgroundColor: shirtBody, borderColor: shirtBody},
          ],
          shown && !earned && styles.circleRevealed,
          selectedToken && styles.circleSelected,
        ]}>
        <Text
          style={[
            styles.shirtText,
            shown && styles.shirtTextEarned,
            shown && shirtNumber != null && {color: shirtNumber},
          ]}>
          {player.shirt}
        </Text>
        {player.subbedOff ? (
          <View style={[styles.badge, styles.badgeTopLeft]}>
            <ArrowLeftRight size={9} color={colors.muted} strokeWidth={2.25} />
          </View>
        ) : null}
        {player.captain ? (
          <View style={[styles.badge, styles.badgeTopRight]}>
            <Text maxFontSizeMultiplier={BOARD_TEXT_SCALE} style={styles.captainText}>C</Text>
          </View>
        ) : null}
        {goals > 0 ? (
          <View style={[styles.badge, styles.badgeBottomLeft, goals > 1 && styles.badgeWide]}>
            <Volleyball size={9} color={colors.ink} strokeWidth={2.25} />
            {goals > 1 ? <Text maxFontSizeMultiplier={BOARD_TEXT_SCALE} style={styles.badgeCount}>{goals}</Text> : null}
          </View>
        ) : null}
        {assists > 0 ? (
          <View style={[styles.badge, styles.badgeBottomRight, assists > 1 && styles.badgeWide]}>
            <Footprints size={9} color={colors.ink} strokeWidth={2.25} />
            {assists > 1 ? <Text maxFontSizeMultiplier={BOARD_TEXT_SCALE} style={styles.badgeCount}>{assists}</Text> : null}
          </View>
        ) : null}
        {player.redCard || player.yellowCard ? (
          <View style={[styles.badge, styles.badgeMid]}>
            <View
              style={[
                styles.cardIcon,
                player.redCard ? styles.cardRed : styles.cardYellow,
              ]}
            />
          </View>
        ) : null}
      </View>
      <Text
        maxFontSizeMultiplier={BOARD_TEXT_SCALE}
        style={[styles.posLabel, selectedToken && styles.posLabelSelected]}>
        {label}
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

/** "Come back in" + a live HH:MM:SS to the next daily sheet (next local midnight). */
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
const CIRCLE_BORDER = 2;
/**
 * Badge centres sit exactly on the circle outline at the 45° point.
 *
 * The border argument is the part that's easy to miss: an absolutely positioned
 * child is laid out against its parent's PADDING box, which starts inside the
 * circle's border. Without it every badge was pulled inward by the border width
 * on both axes — 2.83pt diagonally, measured off a screenshot at 22.16pt from
 * the centre when the rim is at 25pt.
 */
const BADGE_ON_RIM = onRim(CIRCLE, BADGE, CIRCLE_BORDER);

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
  matchTitle: {marginBottom: spacing.xs},
  boardWrap: {flex: 1, marginTop: spacing.md},
  board: {flex: 1},
  boardContent: {paddingVertical: spacing.md},
  // One formation line: GK alone up top, then defence down to attack. Fixed
  // token sizes and centred rows keep 1/2/3/4/5-man lines visually identical.
  formationRow: {
    // Data lists each line right to left (RB first, CURATION.md) and the
    // board attacks up the screen, so rows render reversed to put the right
    // back on the viewer's right.
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 6,
  },
  // Five-man lines trim the gap and the tokens' side padding (never the
  // circle) so wide formations stay inside every screen width.
  formationRowTight: {gap: 2},
  // relative so the pitch markings (an absolute-fill layer, first child) sit
  // behind the rows; the rows stay in normal flow and paint on top.
  pitch: {gap: spacing.md, position: 'relative'},
  token: {width: TOKEN_WIDTH, alignItems: 'center', gap: 3},
  tokenTight: {width: CIRCLE + 4},
  posLabel: {
    fontFamily: fonts.medium,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.5,
    color: c.textTertiary,
  },
  posLabelSelected: {color: c.primary},
  // The player circle: shirt number where the face would be. Surface while
  // hidden, brand purple once earned, primary ring while targeted.
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: CIRCLE_BORDER,
    borderColor: c.divider,
  },
  circleSelected: {borderColor: c.primary},
  circleEarned: {backgroundColor: c.primary, borderColor: c.primary},
  // Revealed-by-surrender: the shirt shows, but faded — not earned.
  circleRevealed: {opacity: 0.55},
  // Explicit tight lineHeight: without it the themed lineHeight pushes the
  // digits off-centre inside the circle.
  shirtText: {
    fontFamily: fonts.medium,
    fontSize: 18,
    lineHeight: 22,
    color: c.muted,
    fontVariant: ['tabular-nums'],
  },
  shirtTextEarned: {color: c.onInk},
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
    backgroundColor: c.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.divider,
  },
  badgeWide: {paddingHorizontal: 3},
  // Badge centres sit exactly on the circle outline: corners at the rim's
  // 45° points, the card badge at its waist (180°).
  badgeTopLeft: {top: BADGE_ON_RIM, left: BADGE_ON_RIM},
  badgeTopRight: {top: BADGE_ON_RIM, right: BADGE_ON_RIM},
  badgeBottomLeft: {bottom: BADGE_ON_RIM, left: BADGE_ON_RIM},
  badgeBottomRight: {bottom: BADGE_ON_RIM, right: BADGE_ON_RIM},
  badgeMid: {
    top: CIRCLE / 2 - BADGE / 2 - CIRCLE_BORDER,
    left: -BADGE / 2 - CIRCLE_BORDER,
  },
  cardIcon: {width: 6, height: 9, borderRadius: 1.5},
  // Yellow card is a fixed football colour in both themes.
  cardYellow: {backgroundColor: '#F2C230'},
  cardRed: {backgroundColor: c.error},
  badgeCount: {
    fontFamily: fonts.medium,
    fontSize: 8,
    lineHeight: 10,
    color: c.ink,
    fontVariant: ['tabular-nums'],
  },
  captainText: {
    fontFamily: fonts.medium,
    fontSize: 8,
    lineHeight: 10,
    color: c.muted,
  },
  // adjustsFontSizeToFit needs a bounded box, so the name gets an explicit
  // width (slightly past the token so scaling only kicks in for the truly
  // long surnames — Jankulovski, Grobbelaar).
  tokenName: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 13,
    color: c.ink,
    textAlign: 'center',
    width: TOKEN_WIDTH + 6,
  },
  tokenNameTight: {width: CIRCLE + 8},
  tokenNameRevealed: {color: c.textTertiary},
  scoreTeam: {fontFamily: fonts.medium, color: c.primary},
  inputPanel: {gap: spacing.sm, paddingBottom: spacing.sm},
  giveUp: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  finishPanel: {gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm},
  streakRow: {flexDirection: 'row', justifyContent: 'center', gap: spacing.xl},
  stat: {alignItems: 'center', gap: 2},
  statValueHot: {color: c.primary},
  countdownWrap: {alignItems: 'center', gap: 2},
  countdown: {fontVariant: ['tabular-nums'], letterSpacing: 1},
  });
