import React from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {radii, type as typeScale, useColors, type Palette} from '../../theme';
import {haptics} from '../haptics';
import {usePressScale} from './usePressScale';

export type ButtonVariant = 'primary' | 'secondary' | 'outline';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** Stretch to fill the container width (default true — Home stacks full-width). */
  fullWidth?: boolean;
  /**
   * `md` (default) is the page's CTA. `sm` is an inline row action — a friend
   * request's Accept, sitting beside a name and a 32pt decline — where a 48pt
   * pill outweighs the row it lives in.
   */
  size?: 'md' | 'sm';
  disabled?: boolean;
  /**
   * When set, a disabled button keeps its greyed look but stays tappable and
   * routes presses here instead of `onPress` — so the tap can explain *why*
   * the action is unavailable (toast/haptic) rather than dying silently.
   * The caller owns the feedback; no confirm haptic or press-scale fires.
   */
  onDisabledPress?: () => void;
  /** Optional icon pinned to the right edge; the label stays centered. */
  trailingIcon?: React.ReactNode;
  /** Optional icon pinned to the left edge; the label stays centered. */
  leadingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * The pill button — three variants, all fully round, all sharing
 * the springy press-scale (design.md §5):
 *  - `primary`   solid brand fill, hairline rim, fully flat (no shadow —
 *                the fill alone carries the hierarchy)
 *  - `secondary` surface fill with an ink border (the "Join match" pill)
 *  - `outline`   divider-hairline border on surface (tertiary CTA)
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  fullWidth = true,
  size = 'md',
  disabled = false,
  onDisabledPress,
  trailingIcon,
  leadingIcon,
  style,
  accessibilityHint,
}: Props) {
  const press = usePressScale();
  const colors = useColors();
  const isPrimary = variant === 'primary';

  // A light tap confirms the press landed (no-op when haptics are off/absent).
  const handlePress = onPress
    ? () => {
        haptics.tap();
        onPress();
      }
    : undefined;

  return (
    <Pressable
      onPress={disabled ? onDisabledPress : handlePress}
      onPressIn={disabled ? undefined : press.onPressIn}
      onPressOut={disabled ? undefined : press.onPressOut}
      disabled={disabled && !onDisabledPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{disabled}}
      style={fullWidth ? styles.fullWidth : undefined}>
      <Animated.View
        style={[
          styles.base,
          size === 'sm' && styles.small,
          variantStyles(colors)[variant],
          disabled && styles.disabled,
          press.animatedStyle,
          style,
        ]}>
        {leadingIcon ? <View style={styles.leading}>{leadingIcon}</View> : null}
        {/* A pill is one line by definition: its radius is derived from its
            height, so a wrapped label doesn't just look cramped, it inflates the
            whole shape into an ellipse. Truncation is the honest failure. */}
        <Animated.Text
          numberOfLines={1}
          style={[
            styles.label,
            {color: isPrimary ? colors.onInk : colors.textPrimary},
          ]}>
          {label}
        </Animated.Text>
        {trailingIcon ? <View style={styles.trailing}>{trailingIcon}</View> : null}
      </Animated.View>
    </Pressable>
  );
}

const variantStyles = (c: Palette): Record<ButtonVariant, ViewStyle> => ({
  primary: {
    backgroundColor: c.primary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.solidRim,
  },
  secondary: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.ink,
  },
  outline: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.divider,
  },
});

const styles = StyleSheet.create({
  fullWidth: {alignSelf: 'stretch'},
  base: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Inline-row size: still a comfortable target, no longer a page CTA.
  small: {minHeight: 34, paddingVertical: 7, paddingHorizontal: 14},
  disabled: {opacity: 0.5},
  label: {...typeScale.label, textAlign: 'center'},
  trailing: {position: 'absolute', right: 20, top: 0, bottom: 0, justifyContent: 'center'},
  leading: {position: 'absolute', left: 20, top: 0, bottom: 0, justifyContent: 'center'},
});
