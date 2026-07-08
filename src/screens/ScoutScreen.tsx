import React, {useEffect, useMemo, useState} from 'react';
import {Image, Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {ChevronLeft, HelpCircle, Search} from 'lucide-react-native';
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
import {colors, fonts, radii, screenPadding, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {FOOTBALLERS, getById, POSITION_LABELS, type Footballer} from '../data/football';
import {flagImage, logoImage} from '../games/hattrick/criterionIcon';
import {searchPlayers} from '../games/hattrick/playerSearch';
import {COLUMNS, deriveAttributes} from '../games/scout/compare';
import {
  applyGuess,
  createInitialState,
  EMPTY_STREAK,
  historyEntryFor,
  isFinished,
  recordResult,
} from '../games/scout/engine';
import {
  dailyPool,
  dateKeyFor,
  secretFor,
} from '../games/scout/dailySeed';
import {
  loadDailyProgress,
  loadStreak,
  recordHistory,
  saveDailyProgress,
  saveStreak,
} from '../games/scout/mysteryStorage';
import {MysteryHelpModal} from '../games/scout/MysteryHelpModal';
import type {
  CellResult,
  ColumnKey,
  MysteryState,
  StreakState,
} from '../games/scout/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Scout'>;

/** Solid fill per feedback status; white content reads on all three. */
const STATUS_BG: Record<CellResult['status'], string> = {
  hit: colors.guessHit,
  partial: colors.guessNear,
  miss: colors.guessMiss,
};

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
  const dateKey = useMemo(() => dateKeyFor(new Date()), []);
  const secret = useMemo(() => secretFor(dateKey, dailyPool()), [dateKey]);

  const [state, setState] = useState<MysteryState | null>(null);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Rehydrate today's puzzle (replaying stored guesses through the engine) and
  // the streak. No re-recording here — recordResult only runs on a live finish.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [progress, savedStreak] = await Promise.all([
        loadDailyProgress(dateKey),
        loadStreak(),
      ]);
      let s = createInitialState(dateKey, secret.id);
      if (progress) {
        for (const id of progress.guessedIds) {
          s = applyGuess(s, id);
        }
      }
      if (alive) {
        setState(s);
        setStreak(savedStreak);
      }
    })();
    return () => {
      alive = false;
    };
  }, [dateKey, secret]);

  const guessedIds = state ? state.guesses.map(g => g.footballerId) : [];
  const results = useMemo(() => {
    if (!state || isFinished(state)) {
      return [];
    }
    return searchPlayers(FOOTBALLERS, query, guessedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, state]);

  function openPicker() {
    setQuery('');
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
    setQuery('');
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
    setQuery('');
    setPickerOpen(false);
    saveDailyProgress({dateKey, guessedIds: next.guesses.map(g => g.footballerId)});

    if (isFinished(next)) {
      const won = next.status === 'won';
      if (won) {
        haptics.success();
      } else {
        haptics.error();
      }
      const updated = recordResult(streak, dateKey, won);
      setStreak(updated);
      saveStreak(updated);
      // History data is still recorded (the archive button is removed for now).
      recordHistory(historyEntryFor(next));
    } else {
      haptics.tap();
    }
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
        <TopStatusFade />
      </Screen>
    );
  }

  const finished = isFinished(state);
  const secretPlayer = getById(state.secretId);
  // The answer reveal (shown once finished): flag + crest + position.
  const secretAttrs = secretPlayer ? deriveAttributes(secretPlayer) : undefined;
  const secretFlag = flagImage(secretPlayer?.nationality[0]);
  const secretCrest = logoImage(secretAttrs?.activeClubId);
  const secretPosition =
    secretPlayer?.positions.map(p => POSITION_LABELS[p]).join(' · ') ?? '';

  return (
    <Screen canvas edges={['left', 'right', 'bottom']}>
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
            finished && {
              color: state.status === 'won' ? colors.success : colors.error,
            },
          ]}>
          {finished
            ? state.status === 'won'
              ? t('scout.won', {count: state.guesses.length})
              : t('scout.lost')
            : t('scout.instruction')}
        </Text>
        {!finished ? (
          <Text variant="caption" color="muted" align="center">
            {t('scout.guessCount', {
              current: state.guesses.length + 1,
              max: state.maxGuesses,
            })}
          </Text>
        ) : null}

        {/* Column headers — same flex+gap as the cell rows so each label centres
            over its column. */}
        <View style={styles.columnHeader}>
          {COLUMNS.map(key => (
            <View key={key} style={styles.columnCell}>
              <Text style={styles.columnLabel} numberOfLines={1} adjustsFontSizeToFit>
                {t(`scout.columns.${key}`)}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.headerRule} />

        <ScrollView
          style={styles.board}
          contentContainerStyle={styles.boardContent}
          showsVerticalScrollIndicator={false}>
          {/* Newest guess first. */}
          {state.guesses
            .slice()
            .reverse()
            .map(g => {
              const player = getById(g.footballerId);
              return (
                <View key={g.footballerId} style={styles.guess}>
                  <Text variant="body" numberOfLines={1} style={styles.guessName}>
                    {player?.name ?? g.footballerId}
                  </Text>
                  <View style={styles.cellRow}>
                    {g.cells.map(cell => (
                      <Cell key={cell.key} cell={cell} player={player} />
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
                {secretFlag != null ? (
                  <Image source={secretFlag} resizeMode="contain" style={styles.answerFlag} />
                ) : null}
                {secretCrest != null ? (
                  <Image source={secretCrest} resizeMode="contain" style={styles.answerCrest} />
                ) : null}
                {secretPosition ? (
                  <Text variant="secondary" color="secondary">
                    {secretPosition}
                  </Text>
                ) : null}
                {secretAttrs?.shirtNumber !== undefined ? (
                  <Text variant="secondary" color="secondary">
                    {`#${secretAttrs.shirtNumber}`}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.streakRow}>
              <Stat
                label={t('scout.streakCurrent')}
                value={streak.current}
                highlight={state.status === 'won'}
              />
              <Stat label={t('scout.streakBest')} value={streak.best} />
            </View>
            <Countdown />
          </View>
        ) : (
          // A field-styled trigger; the real search is a top overlay (below) so
          // results always clear the keyboard.
          <Pressable
            style={styles.trigger}
            onPress={openPicker}
            accessibilityRole="button"
            accessibilityLabel={t('scout.searchPlaceholder')}>
            <Search size={18} color={colors.textTertiary} strokeWidth={2} />
            <Text variant="body" color="tertiary">
              {t('scout.searchPlaceholder')}
            </Text>
          </Pressable>
        )}
      </View>

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
      <TopStatusFade />

      {/* Top-anchored search overlay: card near the top, keyboard at the bottom. */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={closePicker}>
        <Pressable style={styles.scrim} onPress={closePicker}>
          <Pressable style={styles.pickCard} onPress={() => {}}>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder={t('scout.searchPlaceholder')}
              autoFocus
              autoCapitalize="words"
              accessibilityLabel={t('scout.searchPlaceholder')}
            />
            <ScrollView
              style={styles.results}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {query.trim() === '' ? (
                <Text variant="secondary" color="secondary" align="center" style={styles.hint}>
                  {t('scout.searchHint')}
                </Text>
              ) : results.length === 0 ? (
                <Text variant="secondary" color="secondary" align="center" style={styles.hint}>
                  {t('scout.noPlayers')}
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

      <MysteryHelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </Screen>
  );
}

/** One feedback cell: coloured by status, showing the guessed player's value. */
function Cell({cell, player}: {cell: CellResult; player: Footballer | undefined}) {
  const attrs = player ? deriveAttributes(player) : undefined;
  const bg = STATUS_BG[cell.status];
  const arrow = cell.direction === 'up' ? '↑' : cell.direction === 'down' ? '↓' : '';

  let content: React.ReactNode = null;
  if (cell.key === 'nationality') {
    const flag = flagImage(player?.nationality[0]);
    content = flag != null ? (
      <Image source={flag} resizeMode="contain" style={styles.cellFlag} />
    ) : (
      <CellText>{player?.nationality[0]?.slice(0, 3) ?? '—'}</CellText>
    );
  } else if (cell.key === 'club') {
    const crest = logoImage(attrs?.activeClubId);
    content = crest != null ? (
      <Image source={crest} resizeMode="contain" style={styles.cellLogo} />
    ) : (
      <CellText>—</CellText>
    );
  } else {
    content = <CellText>{`${cellValue(cell.key, attrs)}${arrow}`}</CellText>;
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
    case 'shirtNumber':
      return attrs.shirtNumber !== undefined ? `${attrs.shirtNumber}` : '—';
    default:
      return '—';
  }
}

function CellText({children}: {children: React.ReactNode}) {
  return (
    <Text style={styles.cellText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
      {children}
    </Text>
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

/** "Come back in" + a live HH:MM:SS to the next daily puzzle (next local midnight). */
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
        {t('scout.comeBackIn')}
      </Text>
      <Text variant="caption" color="muted" align="center" style={styles.countdown}>
        {hhmmss}
      </Text>
    </View>
  );
}

const CELL_GAP = 4;

const styles = StyleSheet.create({
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
  columnHeader: {
    flexDirection: 'row',
    gap: CELL_GAP,
    marginTop: spacing.md,
  },
  columnCell: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.muted,
    textAlign: 'center',
  },
  // Divider separating the header row from the guesses.
  headerRule: {
    height: 1,
    backgroundColor: colors.textTertiary,
    marginTop: spacing.xs,
  },
  board: {flex: 1, marginTop: spacing.xs},
  boardContent: {gap: spacing.md, paddingVertical: spacing.sm},
  guess: {gap: 4},
  guessName: {fontFamily: fonts.medium},
  cellRow: {flexDirection: 'row', gap: CELL_GAP},
  cell: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  cellText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.onInk,
    textAlign: 'center',
  },
  cellFlag: {width: 22, height: 16, borderRadius: 2},
  cellLogo: {width: 22, height: 22},
  emptyHint: {paddingVertical: spacing.xl},
  finishPanel: {gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm},
  // Answer reveal (the payoff): eyebrow + name + flag · crest · position.
  answerReveal: {alignItems: 'center', gap: spacing.xs},
  answerLabel: {letterSpacing: 1},
  answerName: {color: colors.ink},
  answerMeta: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  answerFlag: {width: 24, height: 18, borderRadius: 2},
  answerCrest: {width: 22, height: 22},
  streakRow: {flexDirection: 'row', justifyContent: 'center', gap: spacing.xl},
  stat: {alignItems: 'center', gap: 2},
  statValue: {fontFamily: fonts.medium, fontSize: 20, lineHeight: 24, color: colors.ink},
  statValueHot: {color: colors.primary},
  countdownWrap: {alignItems: 'center', gap: 2},
  countdown: {fontVariant: ['tabular-nums'], letterSpacing: 1},
  // Bottom trigger that opens the search overlay — a glass search field, so the
  // main action speaks the same liquid-glass language as the rest of the app.
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.glassRim,
    marginBottom: spacing.sm,
  },
  // Search overlay anchored near the top so the results clear the keyboard.
  scrim: {
    flex: 1,
    backgroundColor: colors.scrimLight,
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
    borderBottomWidth: 1,
    borderBottomColor: colors.textTertiary,
  },
  resultFlag: {width: 22, height: 16, borderRadius: 2},
  hint: {paddingVertical: spacing.lg},
});
