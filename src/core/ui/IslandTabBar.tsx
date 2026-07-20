import React from 'react';
import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';
import {CalendarDays, CircleUserRound, Home, Volleyball, type LucideIcon} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import {
  fonts,
  radii,
  shadows,
  type as typeScale,
  useSkin,
  useThemedStyles,
  type Palette,
} from '../../theme';
import {usePressScale} from './usePressScale';

export type TabId = 'home' | 'daily' | 'play' | 'profile';

/**
 * Vertical clearance the nav island reserves at the bottom of a screen — the pill
 * height plus its top breathing room. Screens add this (+ safe-area inset) to
 * their content's bottom padding so nothing hides behind the shell nav.
 */
export const NAV_HEIGHT = 81;

// Play is a ball, not a gamepad: a gamepad reads as *video games*, the one
// thing this app isn't. The ball is the only glyph that says football AND "a
// match is on" in the same shape — a tab icon has to carry the action, not just
// the subject. Two rejected on the way: lucide's `Goal` renders at 22pt as a
// target with a play arrow (reads as a record button), and `Shirt` is football
// but signals kit/identity rather than playing. It shares its glyph with Top
// Bins' game icon, which is acceptable: they only ever co-appear on the Daily
// tab, where one is chrome and the other is content.
// Home/Daily/Profile keep conventional icons — the labels below them carry the
// meaning, so the icons only have to avoid misleading.
const ITEMS: {id: TabId; labelKey: string; Icon: LucideIcon}[] = [
  {id: 'home', labelKey: 'tabs.home', Icon: Home},
  {id: 'daily', labelKey: 'tabs.daily', Icon: CalendarDays},
  {id: 'play', labelKey: 'tabs.play', Icon: Volleyball},
  {id: 'profile', labelKey: 'tabs.profile', Icon: CircleUserRound},
];

type Props = {
  active: TabId;
  onSelect?: (id: TabId) => void;
  /** Tabs to mark with a small "something new" dot (pending friend requests). */
  badge?: Partial<Record<TabId, boolean>>;
};

/**
 * The floating navigation island — Home · Daily · Play · Profile as a
 * centered solid pill (surface fill, one-step-lighter rim). Icons only (the
 * labels live on as accessibility text); the active tab is tinted the accent
 * color, inactive tabs are muted.
 *
 * The springy press-scale is shared by the WHOLE island (Instagram-style): a
 * single animated value scales the entire bar, and pressing any item drives it,
 * so the whole navbar zooms on a tap — not just the pressed icon.
 */
export function IslandTabBar({active, onSelect, badge}: Props) {
  const press = usePressScale();
  const {t} = useTranslation();
  const {colors} = useSkin();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {/* Outer layer carries the shadow (a clipped view clips its own shadow on
          iOS); the inner pill clips content to the rounded shape. */}
      <Animated.View style={[styles.island, press.animatedStyle]}>
        <View style={styles.pill}>
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
                {/* The label is the tab's real name. Icons alone left Daily
                    (a calendar) and Play indistinguishable to anyone who
                    hadn't already learned the app. */}
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                  style={[styles.label, {color}]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  wrap: {alignItems: 'center', paddingTop: 12},
  // Shadow-only layer (no clip, so the ambient lift isn't cut off).
  island: {
    borderRadius: radii.pill,
    ...shadows.floating,
  },
  // Visible pill: solid surface one step above the canvas, rimmed a step
  // lighter still (elevation is brightness, never shadow on the fill itself).
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: c.divider,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  // paddingVertical 8 + icon 22 + gap 3 + label 14 = a 55pt tap target, still
  // well clear of the 44pt HIG minimum. minWidth 66 fits the longest label
  // ("Profile", ~40pt at 12/Medium) inside the 10pt side padding.
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 66,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  iconWrap: {position: 'relative'},
  // caption from the scale, in Medium — small enough to stay quiet under the
  // icon, on-scale rather than another bespoke size.
  label: {
    fontFamily: fonts.medium,
    fontSize: typeScale.caption.fontSize,
    lineHeight: 14,
  },
  // "Something new" marker: a small accent disc pinned to the icon's top-right
  // corner, rimmed so it reads on the pill (same trick as onlineDot).
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.primary,
    borderWidth: 1.5,
    borderColor: c.surface,
  },
  });
