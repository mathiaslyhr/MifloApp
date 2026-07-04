import React from 'react';
import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';
import {Gamepad2, Home, Menu, type LucideIcon} from 'lucide-react-native';
import {colors, fonts, radii} from '../../theme';
import {usePressScale} from './usePressScale';

export type TabId = 'home' | 'games' | 'menu';

const ITEMS: {id: TabId; label: string; Icon: LucideIcon}[] = [
  {id: 'home', label: 'Home', Icon: Home},
  {id: 'games', label: 'Games', Icon: Gamepad2},
  {id: 'menu', label: 'Menu', Icon: Menu},
];

type Props = {
  active: TabId;
  /** Tapping a tab. No-op tabs (Games/Menu) are inert until the nav shell wires them. */
  onSelect?: (id: TabId) => void;
};

/**
 * The floating navigation island — Home · Games · Menu as a centered, "clear"
 * frosted pill. Icons + labels stack vertically; the active tab is tinted the
 * accent purple, inactive tabs are muted.
 *
 * The springy press-scale is shared by the WHOLE island (Instagram-style): a
 * single animated value scales the entire bar, and pressing any item drives it,
 * so the whole navbar zooms on a tap — not just the pressed icon.
 */
export function IslandTabBar({active, onSelect}: Props) {
  const press = usePressScale();
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View style={[styles.island, press.animatedStyle]}>
        {ITEMS.map(({id, label, Icon}) => {
          const on = id === active;
          const color = on ? colors.primary : colors.muted;
          return (
            <Pressable
              key={id}
              onPress={() => onSelect?.(id)}
              onPressIn={press.onPressIn}
              onPressOut={press.onPressOut}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{selected: on}}
              style={styles.item}>
              <Icon size={22} color={color} strokeWidth={2} />
              <Text style={[styles.label, {color}]}>{label}</Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center', paddingTop: 12},
  island: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    // "Clear" frosted glass — matches the secondary (Join a room) button.
    backgroundColor: colors.glassLight,
    borderColor: colors.glassRim,
    shadowColor: '#140F32',
    shadowOpacity: 0.18,
    shadowOffset: {width: 0, height: 16},
    shadowRadius: 24,
    elevation: 8,
  },
  item: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 10,
    lineHeight: 12,
    marginTop: 2,
  },
});
