import React from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import {Text} from '../../core/ui';
import {colors, radii, spacing} from '../../theme';

export type InlineSuggestion = {
  /** Stable identity for the row (footballer id, folded label, …). */
  key: string;
  label: string;
  /** Metro asset id from `flagImage()`; omitted renders no flag slot. */
  flag?: number;
  /**
   * Position code (GK/DF/MF/FW). Shown as a pill after the name ONLY when
   * another visible row carries the exact same name, so identically-named
   * players can be told apart. Ignored when the name is unique in the list.
   */
  position?: string;
};

/**
 * The type-ahead suggestion card every guess input shares — a glass surface of
 * flag+name rows floating above the text field. Dumb on purpose: callers own
 * the search and what a pick submits; this only renders and reports taps.
 */
export function InlineSuggestions<T extends InlineSuggestion>({
  items,
  onPick,
}: {
  items: readonly T[];
  onPick: (item: T) => void;
}) {
  // Names that appear on more than one visible row — those rows get a position
  // pill to disambiguate; unique names stay clean.
  const clashingNames = React.useMemo(() => {
    const seen = new Set<string>();
    const clashing = new Set<string>();
    for (const item of items) {
      if (seen.has(item.label)) {
        clashing.add(item.label);
      }
      seen.add(item.label);
    }
    return clashing;
  }, [items]);

  if (items.length === 0) {
    return null;
  }
  return (
    <View style={styles.card}>
      {items.map(item => {
        const showPill = item.position != null && clashingNames.has(item.label);
        return (
          <Pressable
            key={item.key}
            style={styles.row}
            onPress={() => onPick(item)}
            accessibilityRole="button"
            accessibilityLabel={
              showPill ? `${item.label}, ${item.position}` : item.label
            }>
            {item.flag != null ? (
              <Image source={item.flag} resizeMode="contain" style={styles.flag} />
            ) : null}
            <Text variant="body" numberOfLines={1} style={styles.label}>
              {item.label}
            </Text>
            {showPill ? (
              <View style={styles.pill}>
                <Text variant="caption" color="secondary" style={styles.pillText}>
                  {item.position}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.glassRim,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  flag: {width: 22, height: 16, borderRadius: 2},
  label: {flex: 1},
  pill: {
    backgroundColor: colors.surface2,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pillText: {letterSpacing: 0.3},
});
