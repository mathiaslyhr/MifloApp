import React from 'react';
import {Pressable, StyleSheet} from 'react-native';
import {Bug} from 'lucide-react-native';
import {colors, spacing} from '../../theme';
import {Text} from '../ui';

type Props = {
  label: string;
  onPress: () => void;
};

/**
 * The quiet "report a bug" text link that closes every game screen — muted so
 * it never competes with the game's CTAs, but always in the same place.
 */
export function BugReportLink({label, onPress}: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.link}>
      <Bug size={14} color={colors.muted} strokeWidth={2} />
      <Text variant="caption" color="muted">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
});
