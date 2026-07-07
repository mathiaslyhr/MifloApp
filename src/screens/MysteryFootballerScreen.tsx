import React, {useEffect, useMemo, useState} from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import {ChevronLeft, HelpCircle, History, Search} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Button, CircleButton, Screen, Text, TextField, toast} from '../core/ui';
import {haptics} from '../core/haptics';
import {colors, fonts, radii, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {FOOTBALLERS, getById, type Footballer} from '../data/football';
import {flagImage, logoImage} from '../games/tic-tac-toe/criterionIcon';
import {searchPlayers} from '../games/tic-tac-toe/playerSearch';
import {COLUMNS, deriveAttributes} from '../games/mystery-footballer/compare';
import {
  applyGuess,
  createInitialState,
  EMPTY_STREAK,
  historyEntryFor,
  isFinished,
  recordResult,
  upsertHistory,
} from '../games/mystery-footballer/engine';
import {
  dailyPool,
  dateKeyFor,
  secretFor,
} from '../games/mystery-footballer/dailySeed';
import {buildShareGrid} from '../games/mystery-footballer/share';
import {
  loadDailyProgress,
  loadHistory,
  loadStreak,
  recordHistory,
  saveDailyProgress,
  saveStreak,
} from '../games/mystery-footballer/mysteryStorage';
import {MysteryHelpModal} from '../games/mystery-footballer/MysteryHelpModal';
import {MysteryHistoryModal} from '../games/mystery-footballer/MysteryHistoryModal';
import type {
  CellResult,
  ColumnKey,
  HistoryLog,
  MysteryState,
  StreakState,
} from '../games/mystery-footballer/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MysteryFootballer'>;

/** Solid fill per feedback status; white content reads on all three. */
const STATUS_BG: Record<CellResult['status'], string> = {
  hit: colors.success,
  partial: '#E8A93C',
  miss: '#9A9AA6',
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

export function MysteryFootballerScreen({navigation}: Props) {
  const {t} = useTranslation();
  const dateKey = useMemo(() => dateKeyFor(new Date()), []);
  const secret = useMemo(() => secretFor(dateKey, dailyPool()), [dateKey]);

  const [state, setState] = useState<MysteryState | null>(null);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [history, setHistory] = useState<HistoryLog>({});
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Rehydrate today's puzzle (replaying stored guesses through the engine) and
  // the streak. No re-recording here — recordResult only runs on a live finish.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [progress, savedStreak, savedHistory] = await Promise.all([
        loadDailyProgress(dateKey),
        loadStreak(),
        loadHistory(),
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
        setHistory(savedHistory);
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
      toast.neutral(t('mystery.alreadyGuessed'));
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
      const entry = historyEntryFor(next);
      setHistory(upsertHistory(history, entry));
      recordHistory(entry);
    } else {
      haptics.tap();
    }
  }

  function handleShare() {
    if (!state) {
      return;
    }
    haptics.tap();
    Share.share({
      message: `${buildShareGrid(state)}\n\n${t('mystery.shareCaption')}`,
    }).catch(() => {});
  }

  if (!state) {
    return (
      <Screen canvas>
        <Header onBack={() => navigation.goBack()} onHistory={() => setShowHistory(true)} />
        <View style={styles.loading}>
          <Text variant="body" color="secondary">
            {t('mystery.loading')}
          </Text>
        </View>
      </Screen>
    );
  }

  const finished = isFinished(state);
  const secretPlayer = getById(state.secretId);

  return (
    <Screen canvas>
      <Header
        onBack={() => navigation.goBack()}
        onHistory={() => setShowHistory(true)}
        onHelp={() => setShowHelp(true)}
      />

      <View style={styles.body}>
        <Text variant="section" align="center" style={styles.instruction}>
          {finished
            ? state.status === 'won'
              ? t('mystery.won', {count: state.guesses.length})
              : t('mystery.lost')
            : t('mystery.instruction')}
        </Text>
        {!finished ? (
          <Text variant="caption" color="muted" align="center">
            {t('mystery.guessCount', {
              current: state.guesses.length + 1,
              max: state.maxGuesses,
            })}
          </Text>
        ) : null}

        {/* Column headers, aligned with the cells below, split by dividers. */}
        <View style={styles.columnHeader}>
          {COLUMNS.map((key, i) => (
            <View key={key} style={[styles.columnCell, i > 0 && styles.columnDivider]}>
              <Text style={styles.columnLabel} numberOfLines={1} adjustsFontSizeToFit>
                {t(`mystery.columns.${key}`)}
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
              {t('mystery.searchHint')}
            </Text>
          ) : null}
        </ScrollView>

        {finished ? (
          <View style={styles.finishPanel}>
            <Text variant="body" align="center" color="secondary">
              {t('mystery.answerWas', {name: secretPlayer?.name ?? '?'})}
            </Text>
            <View style={styles.streakRow}>
              <Stat label={t('mystery.streakCurrent')} value={streak.current} />
              <Stat label={t('mystery.streakBest')} value={streak.best} />
            </View>
            <Button label={t('mystery.share')} variant="primary" onPress={handleShare} />
            <Text variant="caption" color="muted" align="center">
              {t('mystery.lockedUntilTomorrow')}
            </Text>
          </View>
        ) : (
          // A field-styled trigger; the real search is a top overlay (below) so
          // results always clear the keyboard.
          <Pressable
            style={styles.trigger}
            onPress={openPicker}
            accessibilityRole="button"
            accessibilityLabel={t('mystery.searchPlaceholder')}>
            <Search size={18} color={colors.textTertiary} strokeWidth={2} />
            <Text style={styles.triggerText}>{t('mystery.searchPlaceholder')}</Text>
          </Pressable>
        )}
      </View>

      {/* Top-anchored search overlay: card near the top, keyboard at the bottom. */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="none"
        onRequestClose={closePicker}>
        <Pressable style={styles.scrim} onPress={closePicker}>
          <Pressable style={styles.pickCard} onPress={() => {}}>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder={t('mystery.searchPlaceholder')}
              autoFocus
              autoCapitalize="words"
              accessibilityLabel={t('mystery.searchPlaceholder')}
            />
            <ScrollView
              style={styles.results}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {query.trim() === '' ? (
                <Text variant="secondary" color="secondary" align="center" style={styles.hint}>
                  {t('mystery.searchHint')}
                </Text>
              ) : results.length === 0 ? (
                <Text variant="secondary" color="secondary" align="center" style={styles.hint}>
                  {t('mystery.noPlayers')}
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
      <MysteryHistoryModal
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        todayKey={dateKey}
        history={history}
      />
    </Screen>
  );
}

/** One feedback cell: coloured by status, showing the guessed player's value. */
function Cell({cell, player}: {cell: CellResult; player: Footballer | undefined}) {
  const attrs = player ? deriveAttributes(player) : undefined;
  const bg = STATUS_BG[cell.status];
  const arrow = cell.direction === 'up' ? '▲' : cell.direction === 'down' ? '▼' : '';

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

function Stat({label, value}: {label: string; value: number}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text variant="caption" color="muted">
        {label}
      </Text>
    </View>
  );
}

function Header({
  onBack,
  onHistory,
  onHelp,
}: {
  onBack: () => void;
  onHistory?: () => void;
  onHelp?: () => void;
}) {
  const {t} = useTranslation();
  return (
    <View style={styles.header}>
      <CircleButton size={36} accessibilityLabel={t('mystery.back')} onPress={onBack}>
        <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
      </CircleButton>
      <Text variant="wordmark" align="center" numberOfLines={1} style={styles.title}>
        {t('mystery.title')}
      </Text>
      <View style={styles.headerRight}>
        {onHistory ? (
          <CircleButton
            size={36}
            accessibilityLabel={t('mystery.history.title')}
            onPress={onHistory}>
            <History size={18} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        ) : null}
        {onHelp ? (
          <CircleButton size={36} accessibilityLabel={t('mystery.help.title')} onPress={onHelp}>
            <HelpCircle size={18} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        ) : null}
      </View>
    </View>
  );
}

const CELL_GAP = 4;

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
  headerRight: {flexDirection: 'row', gap: spacing.xs},
  body: {flex: 1, paddingTop: spacing.md},
  instruction: {marginBottom: spacing.xs},
  columnHeader: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  columnCell: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.divider,
  },
  columnLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    lineHeight: 13,
    color: colors.muted,
    textAlign: 'center',
  },
  // Divider separating the header row from the guesses.
  headerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
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
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 15,
    color: colors.onInk,
    textAlign: 'center',
  },
  cellFlag: {width: 22, height: 16, borderRadius: 2},
  cellLogo: {width: 22, height: 22},
  emptyHint: {paddingVertical: spacing.xl},
  finishPanel: {gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm},
  streakRow: {flexDirection: 'row', justifyContent: 'center', gap: spacing.xl},
  stat: {alignItems: 'center', gap: 2},
  statValue: {fontFamily: fonts.medium, fontSize: 28, color: colors.ink},
  // Bottom trigger that opens the search overlay (styled like a text field).
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg - 1,
    borderRadius: radii.button,
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.divider,
    marginBottom: spacing.sm,
  },
  triggerText: {fontFamily: fonts.regular, fontSize: 16, color: colors.textTertiary},
  // Search overlay anchored near the top so the results clear the keyboard.
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
});
