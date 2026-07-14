/**
 * The app's one search experience — a full-screen picker in the FotMob mould: a
 * pill search field pinned at the top (magnifier + inline clear) beside a round
 * close button, and results as a 3-column grid of artwork tiles (crest / flag /
 * portrait / avatar with the name below). Every search in the app — players,
 * clubs, nations, users — routes through this via `useSearch().open(source)`,
 * so it reads the same everywhere and re-skins for free (all colors are tokens).
 *
 * The matching lives in the `SearchSource` the caller passes (see
 * `searchSources.ts`); this component only renders and reports the pick.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {Search, X} from 'lucide-react-native';
import {Avatar, PressableScale, Text} from '../../core/ui';
import {
  fonts,
  radii,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../../theme';
import type {SearchItem, SearchSource} from './searchSources';

export type {SearchItem, SearchSource} from './searchSources';

/** Per-open copy overrides; anything omitted falls back to the shared strings. */
export type SearchOpts = {
  /** Optional context line under the field (e.g. a Hattrick cell's criteria or
   * a daily clue). Omitted for a plain search. */
  title?: string;
  placeholder?: string;
  /** Shown before the user types. */
  emptyHint?: string;
  /** Shown when a non-empty query matches nothing. */
  noMatch?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

type OpenFn = (
  source: SearchSource,
  opts?: SearchOpts,
) => Promise<SearchItem | null>;

const SearchContext = createContext<OpenFn | null>(null);

/** Open the shared search grid; resolves with the picked item, or null if the
 * user dismisses it. */
export function useSearch(): OpenFn {
  const open = useContext(SearchContext);
  if (!open) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return open;
}

/** Mounts the single search overlay and hands `open()` to the tree. */
export function SearchProvider({children}: {children: React.ReactNode}) {
  const [active, setActive] = useState<{
    source: SearchSource;
    opts: SearchOpts;
  } | null>(null);
  const resolver = useRef<((item: SearchItem | null) => void) | null>(null);

  const open = useCallback<OpenFn>((source, opts = {}) => {
    // Resolve any picker already open (shouldn't overlap, but never leak).
    resolver.current?.(null);
    return new Promise<SearchItem | null>(resolve => {
      resolver.current = resolve;
      setActive({source, opts});
    });
  }, []);

  const finish = useCallback((item: SearchItem | null) => {
    resolver.current?.(item);
    resolver.current = null;
    setActive(null);
  }, []);

  return (
    <SearchContext.Provider value={open}>
      {children}
      <Modal
        visible={active != null}
        animationType="slide"
        onRequestClose={() => finish(null)}>
        {active ? (
          <SearchScreen
            source={active.source}
            opts={active.opts}
            onPick={finish}
            onClose={() => finish(null)}
          />
        ) : null}
      </Modal>
    </SearchContext.Provider>
  );
}

/**
 * A pill that looks like a search field but opens the full-screen grid on tap —
 * the entry point on screens that used to carry an inline type-ahead (the daily
 * puzzles). Callers own what the tap does (usually `useSearch().open(...)`).
 */
export function SearchField({
  placeholder,
  onPress,
}: {
  placeholder: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={styles.field}
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel={placeholder}>
      <Search size={18} color={colors.textTertiary} strokeWidth={2} />
      <Text variant="body" color="tertiary" style={styles.fieldPlaceholder}>
        {placeholder}
      </Text>
    </Pressable>
  );
}

function SearchScreen({
  source,
  opts,
  onPick,
  onClose,
}: {
  source: SearchSource;
  opts: SearchOpts;
  onPick: (item: SearchItem) => void;
  onClose: () => void;
}) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const [query, setQuery] = useState('');
  // Focus lifts the pill's border to the brand color (the TextField recipe).
  const [inputFocused, setInputFocused] = useState(false);

  const trimmed = query.trim();
  const results = useMemo(
    () => (trimmed === '' ? [] : source.search(query)),
    [source, query, trimmed],
  );

  // A subtitle shows only to tell apart two results with the same name.
  const clashing = useMemo(() => {
    const seen = new Set<string>();
    const clash = new Set<string>();
    for (const item of results) {
      if (seen.has(item.label)) {
        clash.add(item.label);
      }
      seen.add(item.label);
    }
    return clash;
  }, [results]);

  // Three fixed-width columns, left-aligned (last row doesn't stretch).
  const gap = spacing.sm;
  const tileWidth = Math.floor((width - spacing.lg * 2 - gap * 2) / 3);

  return (
    <View style={[styles.root, {paddingTop: insets.top + spacing.sm}]}>
      <View style={styles.topBar}>
        <View style={[styles.field, inputFocused && styles.fieldFocused]}>
          <Search size={18} color={colors.textTertiary} strokeWidth={2} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={opts.placeholder ?? t('search.placeholder')}
            placeholderTextColor={colors.textTertiary}
            autoFocus
            autoCorrect={false}
            autoCapitalize={opts.autoCapitalize ?? 'words'}
            returnKeyType="search"
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            accessibilityLabel={opts.placeholder ?? t('search.placeholder')}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('search.clear')}>
              <X size={18} color={colors.textTertiary} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
        <PressableScale
          style={styles.closeBtn}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('search.close')}>
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </PressableScale>
      </View>

      {opts.title ? (
        <Text
          variant="label"
          align="center"
          numberOfLines={2}
          style={styles.title}>
          {opts.title}
        </Text>
      ) : null}

      {trimmed === '' ? (
        <Text
          variant="secondary"
          color="secondary"
          align="center"
          style={styles.message}>
          {opts.emptyHint ?? t('search.hint')}
        </Text>
      ) : results.length === 0 ? (
        <Text
          variant="secondary"
          color="secondary"
          align="center"
          style={styles.message}>
          {opts.noMatch ?? t('search.noMatch')}
        </Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          numColumns={3}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.column}
          contentContainerStyle={[
            styles.grid,
            {paddingBottom: insets.bottom + spacing.xxl},
          ]}
          renderItem={({item}) => (
            <Tile
              item={item}
              width={tileWidth}
              showSubtitle={clashing.has(item.label)}
              onPress={() => onPick(item)}
            />
          )}
        />
      )}
    </View>
  );
}

function Tile({
  item,
  width,
  showSubtitle,
  onPress,
}: {
  item: SearchItem;
  width: number;
  showSubtitle: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const a11y =
    showSubtitle && item.subtitle
      ? `${item.label}, ${item.subtitle}`
      : item.label;
  return (
    <Pressable
      style={[styles.tile, {width}]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}>
      <View style={styles.badgeArt}>
        {item.avatar ? (
          <Avatar
            initials={item.avatar.initials}
            uri={item.avatar.uri}
            tone="surface"
            size={Math.round(width * 0.5)}
          />
        ) : item.image != null ? (
          <Image
            source={item.image}
            resizeMode="contain"
            style={styles.badgeImg}
          />
        ) : null}
      </View>
      <Text variant="secondary" numberOfLines={2} align="center" style={styles.label}>
        {item.label}
      </Text>
      {showSubtitle && item.subtitle ? (
        <Text variant="caption" color="tertiary" align="center" numberOfLines={1}>
          {item.subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
      paddingHorizontal: spacing.lg,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingBottom: spacing.md,
    },
    field: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: c.surfaceSunken,
      // 2px border always reserved so focus doesn't shift the layout.
      borderWidth: 2,
      borderColor: c.divider,
    },
    input: {
      flex: 1,
      fontFamily: fonts.regular,
      fontSize: 16,
      letterSpacing: -0.2,
      color: c.textPrimary,
      padding: 0,
    },
    closeBtn: {
      width: 44,
      height: 44,
      borderRadius: radii.pill,
      backgroundColor: c.surfaceSunken,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldFocused: {borderColor: c.primary},
    title: {paddingBottom: spacing.md, paddingHorizontal: spacing.lg},
    message: {paddingTop: spacing.xxl, paddingHorizontal: spacing.lg},
    grid: {paddingTop: spacing.xs},
    column: {gap: spacing.sm, marginBottom: spacing.md},
    // The whole tile IS the gray card: art on top, name inside at the bottom.
    tile: {
      aspectRatio: 1,
      borderRadius: radii.card,
      backgroundColor: c.surface2,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    badgeArt: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    badgeImg: {width: '62%', height: '100%'},
    label: {alignSelf: 'stretch'},
    fieldPlaceholder: {flex: 1},
  });
