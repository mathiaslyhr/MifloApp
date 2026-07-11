/**
 * How many rounds/questions a game runs — a minus circle, the value, a plus
 * circle. Shared by every host lobby and pass-and-play setup screen (Red Card,
 * Cult Hero, Offside), each passing its own range and label. Replaces the old
 * per-game rows of preset GlassTag pills: fixed 44×44 circles stay perfectly
 * round at any digit count, and every value in range is reachable.
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Minus, Plus} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import {PressableScale, Text} from '../../core/ui';
import {colors, fonts, radii, spacing} from '../../theme';

export function RoundsStepper({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (rounds: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  const {t} = useTranslation();
  const canDecrement = value > min;
  const canIncrement = value < max;
  return (
    <View style={styles.stepper}>
      <Text variant="caption" color="muted" style={styles.label}>
        {label}
      </Text>
      <View style={styles.row}>
        <StepCircle
          icon={<Minus size={18} color={colors.ink} strokeWidth={2} />}
          enabled={canDecrement}
          onPress={() => onChange(Math.max(min, value - 1))}
          accessibilityLabel={t('common.stepperDown')}
        />
        <Text
          variant="body"
          style={styles.value}
          accessibilityLabel={`${label}: ${value}`}>
          {value}
        </Text>
        <StepCircle
          icon={<Plus size={18} color={colors.ink} strokeWidth={2} />}
          enabled={canIncrement}
          onPress={() => onChange(Math.min(max, value + 1))}
          accessibilityLabel={t('common.stepperUp')}
        />
      </View>
    </View>
  );
}

function StepCircle({
  icon,
  enabled,
  onPress,
  accessibilityLabel,
}: {
  icon: React.ReactNode;
  enabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <PressableScale
      style={[styles.circle, !enabled && styles.circleDisabled]}
      disabled={!enabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{disabled: !enabled}}>
      {icon}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stepper: {gap: spacing.sm, alignItems: 'center'},
  label: {letterSpacing: 1},
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.lg},
  circle: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 2,
    borderColor: colors.glassRim,
  },
  circleDisabled: {opacity: 0.35},
  value: {
    minWidth: 40,
    textAlign: 'center',
    color: colors.ink,
    fontFamily: fonts.regular,
  },
});
