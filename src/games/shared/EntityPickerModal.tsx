import React, {useEffect, useMemo, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet} from 'react-native';
import {Text, TextField} from '../../core/ui';
import {radii, spacing, useThemedStyles, type Palette} from '../../theme';
import {fold} from '../hattrick/playerSearch';
import {InlineSuggestions} from './InlineSuggestions';

/**
 * One selectable row for the generic picker: a stable id (what onPick returns),
 * a display label, an optional bundled image (a crest via `logoImage` or a flag
 * via `flagImage` — the field is any Metro asset id), and pre-folded strings the
 * query matches against.
 */
export type EntityOption = {
  id: string;
  label: string;
  flag?: number;
  /** Folded (accent-insensitive) strings to match — build with `fold`. */
  searchTexts: string[];
};

type Props = {
  visible: boolean;
  title: string;
  placeholder: string;
  /** Shown under the field before the user types anything. */
  hint: string;
  /** Shown when the query matches nothing. */
  empty: string;
  /** The searchable set (clubs, nations, …). */
  options: readonly EntityOption[];
  onPick: (id: string) => void;
  onClose: () => void;
};

const LIMIT = 20;

/** 5 exact · 3 text-prefix · 2 token-prefix · 1 substring — the nameSearch ladder. */
function score(option: EntityOption, q: string): number {
  let best = 0;
  for (const text of option.searchTexts) {
    if (text === q) {
      return 5;
    }
    if (text.startsWith(q)) {
      best = Math.max(best, 3);
    } else if (text.split(/\s+/).some(part => part.startsWith(q))) {
      best = Math.max(best, 2);
    } else if (text.includes(q)) {
      best = Math.max(best, 1);
    }
  }
  return best;
}

/**
 * A generic id-carrying search picker — the club/nation counterpart to
 * FootballerSearchModal. Same light-scrim chrome and InlineSuggestions rows,
 * but the caller supplies the option pool and gets the picked id back (the
 * shared NameEntry search is label-only, so it can't drive a favorite that
 * needs a stable club slug or nation string).
 */
export function EntityPickerModal({
  visible,
  title,
  placeholder,
  hint,
  empty,
  options,
  onPick,
  onClose,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) {
      setQuery('');
    }
  }, [visible]);

  const results = useMemo(() => {
    if (!visible) {
      return [];
    }
    const q = fold(query);
    if (!q) {
      return [];
    }
    return options
      .map(option => ({option, s: score(option, q)}))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s || a.option.label.localeCompare(b.option.label))
      .slice(0, LIMIT)
      .map(x => x.option);
  }, [visible, query, options]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.pickCard} onPress={() => {}}>
          <Text variant="label" align="center">
            {title}
          </Text>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            autoFocus
            autoCapitalize="words"
            accessibilityLabel={placeholder}
          />
          <ScrollView
            style={styles.results}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {query.trim() === '' ? (
              <Text variant="secondary" color="secondary" align="center" style={styles.hint}>
                {hint}
              </Text>
            ) : results.length === 0 ? (
              <Text variant="secondary" color="secondary" align="center" style={styles.hint}>
                {empty}
              </Text>
            ) : (
              <InlineSuggestions
                items={results.map(o => ({
                  key: o.id,
                  label: o.label,
                  flag: o.flag,
                }))}
                onPick={item => onPick(item.key)}
              />
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: c.scrimLight,
      justifyContent: 'flex-start',
      paddingTop: 72,
      paddingHorizontal: spacing.xl,
    },
    pickCard: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 380,
      maxHeight: '70%',
      backgroundColor: c.surface,
      borderRadius: radii.card,
      padding: spacing.lg,
      gap: spacing.md,
    },
    results: {maxHeight: 300},
    hint: {paddingVertical: spacing.lg},
  });
