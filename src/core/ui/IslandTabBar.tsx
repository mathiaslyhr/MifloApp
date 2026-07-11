import React from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import {CircleUserRound, Gamepad2, Home, Users, type LucideIcon} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import {colors, radii, shadows} from '../../theme';
import {usePressScale} from './usePressScale';
import {AppBlur} from './Blur';

export type TabId = 'home' | 'games' | 'social' | 'profile';

/**
 * Vertical clearance the nav island reserves at the bottom of a screen — the pill
 * height plus its top breathing room. Screens add this (+ safe-area inset) to
 * their content's bottom padding so nothing hides behind the shell nav.
 */
export const NAV_HEIGHT = 70;

const ITEMS: {id: TabId; labelKey: string; Icon: LucideIcon}[] = [
  {id: 'home', labelKey: 'tabs.home', Icon: Home},
  {id: 'games', labelKey: 'tabs.games', Icon: Gamepad2},
  {id: 'social', labelKey: 'tabs.social', Icon: Users},
  {id: 'profile', labelKey: 'tabs.profile', Icon: CircleUserRound},
];

type Props = {
  active: TabId;
  /** Tapping a tab. No-op tabs (Games/Menu) are inert until the nav shell wires them. */
  onSelect?: (id: TabId) => void;
  /** Tabs to mark with a small "something new" dot (pending friend requests). */
  badge?: Partial<Record<TabId, boolean>>;
};

/**
 * The floating navigation island — Home · Games · Friends · Profile as a
 * centered, "clear" frosted pill. Icons only (the labels live on as
 * accessibility text); the active tab is tinted the accent purple, inactive
 * tabs are muted.
 *
 * The springy press-scale is shared by the WHOLE island (Instagram-style): a
 * single animated value scales the entire bar, and pressing any item drives it,
 * so the whole navbar zooms on a tap — not just the pressed icon.
 */
export function IslandTabBar({active, onSelect, badge}: Props) {
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
            const dotted = badge?.[id] === true;
            return (
              <Pressable
                key={id}
                onPress={() => onSelect?.(id)}
                onPressIn={press.onPressIn}
                onPressOut={press.onPressOut}
                accessibilityRole="button"
                accessibilityLabel={
                  dotted ? `${label}, ${t('tabs.a11yBadge')}` : label
                }
                accessibilityState={{selected: on}}
                style={styles.item}>
                <View style={styles.iconWrap}>
                  <Icon size={22} color={color} strokeWidth={2} />
                  {dotted ? <View style={styles.badgeDot} /> : null}
                </View>
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
    ...shadows.floating,
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
  // paddingVertical 11 + the 22pt icon = a 44pt tap target (HIG minimum).
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  iconWrap: {position: 'relative'},
  // "Something new" marker: a small accent disc pinned to the icon's top-right
  // corner, rimmed so it reads on the frosted pill (same trick as onlineDot).
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
