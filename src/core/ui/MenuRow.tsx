import React from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import {
  ArrowUpRight,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native';
import {colors, radii, spacing} from '../../theme';
import {Text} from './Text';
import {usePressScale} from './usePressScale';

/** `nav` → in-app destination (chevron); `link` → opens the web (up-right arrow). */
export type MenuRowKind = 'nav' | 'link';

type Props = {
  label: string;
  /** Optional second line — e.g. the current nickname under "Profile". */
  subtitle?: string;
  /** Leading icon; some rows (language options) carry none. */
  Icon?: LucideIcon;
  /** Trailing affordance (defaults to `nav`). */
  kind?: MenuRowKind;
  /** Custom trailing element (a check, a Switch…) — replaces the kind glyph. */
  accessory?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Announced to assistive tech, e.g. the active language option. */
  selected?: boolean;
  /** The last row in a group drops its divider. */
  isLast?: boolean;
  accessibilityHint?: string;
};

/**
 * A single row inside a grouped `MenuGroup` card: a leading icon, a label (with
 * optional subtitle), and a trailing glyph — a chevron for in-app navigation or
 * an up-right arrow for rows that open the web. Carries the shared springy
 * press-feel (design.md §5) like every other control.
 */
export function MenuRow({
  label,
  subtitle,
  Icon,
  kind = 'nav',
  accessory,
  onPress,
  disabled = false,
  selected,
  isLast = false,
  accessibilityHint,
}: Props) {
  const press = usePressScale();
  const Trailing = kind === 'link' ? ArrowUpRight : ChevronRight;
  // Rows without a handler (e.g. a Switch row) skip the button semantics and
  // press-feel — the accessory owns the interaction.
  const pressable = onPress != null && !disabled;

  return (
    <Pressable
      onPress={pressable ? onPress : undefined}
      onPressIn={pressable ? press.onPressIn : undefined}
      onPressOut={pressable ? press.onPressOut : undefined}
      disabled={!pressable}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{disabled, selected}}>
      <Animated.View
        style={[
          styles.row,
          !isLast && styles.divider,
          disabled && styles.disabled,
          press.animatedStyle,
        ]}>
        {Icon ? (
          <Icon size={22} color={colors.textSecondary} strokeWidth={2} />
        ) : null}
        <View style={styles.text}>
          <Text variant="body">{label}</Text>
          {subtitle ? (
            <Text variant="caption" color="tertiary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {accessory !== undefined ? (
          accessory
        ) : onPress ? (
          <Trailing size={20} color={colors.textTertiary} strokeWidth={2} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
    borderRadius: radii.card,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    // A bright white hairline that matches the card's glass rim, so the rim and
    // the row separators read as one piece of glass (not a gray line on frost).
    borderBottomColor: colors.glassRim,
    // Square off the bottom corners so the divider spans full width; the group
    // card clips the outer radius.
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  text: {flex: 1},
  disabled: {opacity: 0.5},
});
