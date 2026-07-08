import React from 'react';
import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';
import {Gamepad2, Home, Menu, type LucideIcon} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import {colors, fonts, radii} from '../../theme';
import {usePressScale} from './usePressScale';
import {AppBlur} from './Blur';

export type TabId = 'home' | 'games' | 'menu';

/**
 * Vertical clearance the nav island reserves at the bottom of a screen — the pill
 * height plus its top breathing room. Screens add this (+ safe-area inset) to
 * their content's bottom padding so nothing hides behind the shell nav.
 */
export const NAV_HEIGHT = 76;

const ITEMS: {id: TabId; labelKey: string; Icon: LucideIcon}[] = [
  {id: 'home', labelKey: 'tabs.home', Icon: Home},
  {id: 'games', labelKey: 'tabs.games', Icon: Gamepad2},
  {id: 'menu', labelKey: 'tabs.menu', Icon: Menu},
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
  const {t} = useTranslation();
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {/* Outer layer carries the shadow (a clipped view clips its own shadow on
          iOS); the inner pill clips the blur to the rounded shape. */}
      <Animated.View style={[styles.island, press.animatedStyle]}>
        <View style={styles.pill}>
          <AppBlur amount={22} />
          {ITEMS.map(({id, labelKey, Icon}) => {
            const on = id === active;
            const color = on ? colors.primary : colors.muted;
            const label = t(labelKey);
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
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center', paddingTop: 12},
  // Shadow-only layer (no clip, so the ambient lift isn't cut off).
  island: {
    borderRadius: radii.pill,
    shadowColor: '#140F32',
    shadowOpacity: 0.18,
    shadowOffset: {width: 0, height: 16},
    shadowRadius: 24,
    elevation: 8,
  },
  // Visible pill: clips the real backdrop blur to the rounded shape. A light
  // tint over the blur keeps the "clear" frosted look; blur shows through.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: colors.glassRim,
    overflow: 'hidden',
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
