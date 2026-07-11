/**
 * Shared building blocks for pass-and-play ("1 device") screens. All copy
 * arrives as props so each game keeps its own i18n namespace
 * (`redCard.local.*`, `offside.local.*`, ...).
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Plus, X} from 'lucide-react-native';
import {Button, CircleButton, GlassTag, Text, TextField} from '../../core/ui';
import {haptics} from '../../core/haptics';
import {colors, spacing} from '../../theme';

/** Most name rows a local setup offers — a couch-sized group. */
export const LOCAL_MAX_PLAYERS = 8;

/** Full-screen "Pass the phone to X" gate with one action to show the content. */
export function PassGate({
  title,
  sub,
  actionLabel,
  onShow,
}: {
  /** Already interpolated, e.g. t('redCard.local.passTo', {name}). */
  title: string;
  sub: string;
  actionLabel: string;
  onShow: () => void;
}) {
  return (
    <>
      <Text variant="section" align="center" style={styles.headline}>
        {title}
      </Text>
      <Text variant="secondary" color="secondary" align="center">
        {sub}
      </Text>
      <Button
        label={actionLabel}
        variant="primary"
        onPress={() => {
          haptics.tap();
          onShow();
        }}
      />
    </>
  );
}

/** Name rows with add/remove, for local-game setup stages. */
export function PlayerNamesEditor({
  names,
  onChange,
  minPlayers,
  maxPlayers,
  placeholder,
  addLabel,
  removeLabel,
}: {
  names: string[];
  onChange: (names: string[]) => void;
  /** Remove buttons hide at this floor. */
  minPlayers: number;
  /** The add row hides at this ceiling. */
  maxPlayers: number;
  placeholder: string;
  addLabel: string;
  removeLabel: string;
}) {
  return (
    <>
      <View style={styles.nameList}>
        {names.map((name, i) => (
          <View key={i} style={styles.nameRow}>
            <View style={styles.nameField}>
              <TextField
                value={name}
                onChangeText={value =>
                  onChange(names.map((n, j) => (j === i ? value : n)))
                }
                placeholder={placeholder}
                autoCapitalize="words"
                maxLength={20}
                accessibilityLabel={placeholder}
              />
            </View>
            {names.length > minPlayers ? (
              <CircleButton
                size={36}
                accessibilityLabel={removeLabel}
                onPress={() => onChange(names.filter((_, j) => j !== i))}>
                <X size={16} color={colors.ink} strokeWidth={2} />
              </CircleButton>
            ) : null}
          </View>
        ))}
      </View>
      {names.length < maxPlayers ? (
        <GlassTag
          onPress={() => onChange([...names, ''])}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={styles.addTag}>
          <Plus size={16} color={colors.ink} strokeWidth={2} />
          <Text variant="body" style={styles.addLabel}>
            {addLabel}
          </Text>
        </GlassTag>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  headline: {color: colors.ink},
  nameList: {gap: spacing.sm},
  nameRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  nameField: {flex: 1},
  addTag: {alignSelf: 'center'},
  addLabel: {color: colors.ink},
});
