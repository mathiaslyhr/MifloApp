import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {minTapTarget, spacing} from '../../theme';
import {Text} from './Text';
import {Icon} from './Icon';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Back affordance. Omit to hide the chevron (e.g. a root screen). */
  onBack?: () => void;
};

/**
 * Custom in-screen header: back chevron on the left, centered title with an
 * optional subtitle. Used where the native stack header can't show a subtitle
 * (Lobby, Standings). Pair with `headerShown: false`.
 */
export function ScreenHeader({title, subtitle, onBack}: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      {onBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          hitSlop={8}
          style={styles.back}>
          <Icon name="chevron-left" size={26} strokeWidth={1.5} />
        </Pressable>
      )}
      <View style={styles.titles} pointerEvents="none">
        <Text variant="section" center>
          {title}
        </Text>
        {subtitle && (
          <Text variant="secondary" color="textSecondary" center>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: minTapTarget,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  back: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  titles: {
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
});
