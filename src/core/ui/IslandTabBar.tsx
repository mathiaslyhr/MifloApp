import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {colors, radii, spacing} from '../../theme';
import type {MainTabParamList} from '../navigation/types';
import {Icon, type IconName} from './Icon';
import {Text} from './Text';

/** Height of the island pill itself (excludes the safe-area gap below it). */
export const ISLAND_BAR_HEIGHT = 60;

/**
 * Bottom padding every tab screen must add to its scroll content so the last
 * item clears the floating island. The bar sits `spacing.sm` above the home
 * indicator, so we account for its height, that gap, the inset, and a little
 * breathing room.
 */
export function useIslandInset(): number {
  const insets = useSafeAreaInsets();
  return ISLAND_BAR_HEIGHT + insets.bottom + spacing.sm + spacing.md;
}

const TABS: Record<keyof MainTabParamList, {icon: IconName; label: string}> = {
  Home: {icon: 'home', label: 'Home'},
  Games: {icon: 'layers', label: 'Games'},
  Menu: {icon: 'menu', label: 'Menu'},
};

/**
 * Floating "island" bottom tab bar. Absolutely positioned so it overlays the
 * screen content; tab screens self-pad via `useIslandInset` to scroll clear.
 */
export function IslandTabBar({state, navigation}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.wrap, {bottom: insets.bottom + spacing.sm}]}
      pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const tab = TABS[route.name as keyof MainTabParamList];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{selected: focused}}
              accessibilityLabel={tab.label}
              onPress={onPress}
              style={styles.item}>
              <Icon
                name={tab.icon}
                size={22}
                color={focused ? 'primary' : 'textSecondary'}
              />
              <Text
                variant="caption"
                color={focused ? 'primary' : 'textSecondary'}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    height: ISLAND_BAR_HEIGHT,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    // No shadow token exists yet — inline a subtle elevation for the float.
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
  },
  item: {
    width: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs / 2,
  },
});
