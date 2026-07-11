import React, {useEffect, useMemo, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet} from 'react-native';
import {Text, TextField} from '../../core/ui';
import {colors, radii, spacing} from '../../theme';
import {FOOTBALLERS} from '../../data/football';
import {searchPlayers} from '../hattrick/playerSearch';
import {flagImage} from '../hattrick/criterionIcon';
import {InlineSuggestions} from './InlineSuggestions';

type Props = {
  visible: boolean;
  /** Header line, e.g. the cell's criteria or the redemption prompt. */
  title: string;
  titleVariant?: 'label' | 'section';
  placeholder: string;
  /** Shown under the field before the player types anything. */
  hint: string;
  /** Shown when the query matches nobody. */
  empty: string;
  /** Footballers hidden from the results (e.g. already used this game). */
  excludedIds?: readonly string[];
  onPick: (footballerId: string) => void;
  onClose: () => void;
};

/**
 * The shared footballer search picker — a light-scrim modal with a search field
 * and flag+name result rows. One recipe for every game that asks the player to
 * name a footballer (Hattrick cell claims, Red Card redemption guesses).
 */
export function FootballerSearchModal({
  visible,
  title,
  titleVariant = 'label',
  placeholder,
  hint,
  empty,
  excludedIds,
  onPick,
  onClose,
}: Props) {
  const [query, setQuery] = useState('');

  // Fresh search each time the picker opens.
  useEffect(() => {
    if (visible) {
      setQuery('');
    }
  }, [visible]);

  // Empty query shows nothing (no pre-search) — results only appear once the
  // player starts typing.
  const results = useMemo(() => {
    if (!visible || query.trim() === '') {
      return [];
    }
    return searchPlayers(FOOTBALLERS, query, excludedIds ?? []);
  }, [visible, query, excludedIds]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      {/* Light scrim so the board/reveal stays visible behind the picker. */}
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.pickCard} onPress={() => {}}>
          <Text variant={titleVariant} align="center">
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
              // Same suggestion rows as the daily games' inline type-ahead —
              // one shared look for every player search in the app.
              <InlineSuggestions
                items={results.map(f => ({
                  key: f.id,
                  label: f.name,
                  flag: flagImage(f.nationality[0]) ?? undefined,
                  position: f.positions[0],
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

const styles = StyleSheet.create({
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
  hint: {paddingVertical: spacing.lg},
});
