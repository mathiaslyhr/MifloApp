/**
 * Shared building blocks for pass-and-play ("1 device") screens. All copy
 * arrives as props so each game keeps its own i18n namespace
 * (`redCard.local.*`, `offside.local.*`, ...).
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Plus, X} from 'lucide-react-native';
import {Button, CircleButton, Tag, Text, TextField} from '../../core/ui';
import {haptics} from '../../core/haptics';
import {spacing, useColors, useThemedStyles, type Palette} from '../../theme';
import {RoundsStepper} from './RoundsStepper';

/** Most name rows a local setup offers — a couch-sized group. */
export const LOCAL_MAX_PLAYERS = 8;

/**
 * A "pass the phone" beat, as data. Containers build one and hand it to the
 * GameView, which renders it INSTEAD of the phase body while keeping the
 * phase's own chrome — so a gate is a modifier on a phase, never a phase of its
 * own. Not local-only: online uses it for Red Card's shared "Ready to vote?".
 */
export type PassGateSpec = {
  /** Already interpolated, e.g. t('redCard.local.passTo', {name}). */
  title: string;
  sub: string;
  actionLabel: string;
};

/** "Pass the phone to X" gate with one action to show the content. */
export function PassGate({
  spec,
  onShow,
}: {
  spec: PassGateSpec;
  onShow: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <>
      <Text variant="section" align="center" style={styles.headline}>
        {spec.title}
      </Text>
      <Text variant="secondary" color="secondary" align="center">
        {spec.sub}
      </Text>
      <Button
        label={spec.actionLabel}
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
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
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
        <Tag
          onPress={() => onChange([...names, ''])}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={styles.addTag}>
          <Plus size={16} color={colors.ink} strokeWidth={2} />
          <Text variant="body" style={styles.addLabel}>
            {addLabel}
          </Text>
        </Tag>
      ) : null}
    </>
  );
}

/**
 * Names + round count + start — the stage every local game opens on. Red Card,
 * Offside and Cult Hero each hand-rolled this identically; only the copy and
 * the floors/ceilings differed.
 *
 * Copy arrives as one object rather than an i18n namespace so every key stays a
 * literal at the call site, greppable and lintable.
 */
export function LocalSetupStage({
  copy,
  names,
  onChange,
  minPlayers,
  maxPlayers,
  rounds,
  onRounds,
  minRounds,
  maxRounds,
  ready,
  onStart,
}: {
  copy: {
    title: string;
    /** Already interpolated with the player floor. */
    sub: string;
    namePlaceholder: string;
    addPlayer: string;
    removePlayer: string;
    roundsLabel: string;
    start: string;
  };
  names: string[];
  onChange: (names: string[]) => void;
  minPlayers: number;
  maxPlayers: number;
  rounds: number;
  onRounds: (rounds: number) => void;
  minRounds: number;
  maxRounds: number;
  /** Enough named players to kick off. */
  ready: boolean;
  onStart: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.setup}>
      <Text variant="section" align="center" style={styles.headline}>
        {copy.title}
      </Text>
      <Text variant="secondary" color="secondary" align="center">
        {copy.sub}
      </Text>
      <PlayerNamesEditor
        names={names}
        onChange={onChange}
        minPlayers={minPlayers}
        maxPlayers={maxPlayers}
        placeholder={copy.namePlaceholder}
        addLabel={copy.addPlayer}
        removeLabel={copy.removePlayer}
      />
      <RoundsStepper
        value={rounds}
        onChange={onRounds}
        min={minRounds}
        max={maxRounds}
        label={copy.roundsLabel}
      />
      <Button
        label={copy.start}
        variant="primary"
        disabled={!ready}
        onPress={onStart}
      />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    headline: {color: c.ink},
    nameList: {gap: spacing.sm},
    nameRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
    nameField: {flex: 1},
    addTag: {alignSelf: 'center'},
    addLabel: {color: c.ink},
    setup: {gap: spacing.lg, alignItems: 'stretch'},
  });
