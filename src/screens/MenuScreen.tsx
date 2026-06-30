import React from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import type {CompositeScreenProps} from '@react-navigation/native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Icon, Screen, Text, useIslandInset} from '../core/ui';
import type {IconName} from '../core/ui';
import {colors, radii, spacing} from '../theme';
import {APP_VERSION} from '../core/config';
import type {
  MainTabParamList,
  RootStackParamList,
} from '../core/navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Menu'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Destination = 'Profile' | 'Stats' | 'Settings' | 'Faq';

const ROWS: {icon: IconName; label: string; route: Destination}[] = [
  {icon: 'person', label: 'Profile', route: 'Profile'},
  {icon: 'trophy', label: 'Your stats', route: 'Stats'},
  {icon: 'settings', label: 'Settings', route: 'Settings'},
  {icon: 'help', label: 'How to play', route: 'Faq'},
];

/** The hub: links to profile, stats, settings, and the FAQ, plus app version. */
export function MenuScreen({navigation}: Props) {
  const bottomInset = useIslandInset();

  return (
    <Screen edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, {paddingBottom: bottomInset}]}
        scrollIndicatorInsets={{bottom: bottomInset}}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title">Menu</Text>
        </View>

        <View style={styles.group}>
          {ROWS.map((row, i) => (
            <MenuRow
              key={row.route}
              icon={row.icon}
              label={row.label}
              divider={i < ROWS.length - 1}
              onPress={() => navigation.navigate(row.route)}
            />
          ))}
        </View>

        <Text variant="caption" color="textSecondary" center style={styles.version}>
          Miflo v{APP_VERSION}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function MenuRow({
  icon,
  label,
  divider,
  onPress,
}: {
  icon: IconName;
  label: string;
  divider: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({pressed}) => [
        styles.row,
        divider && styles.rowDivider,
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} size={22} color="textSecondary" />
      <Text variant="body" style={styles.rowLabel}>
        {label}
      </Text>
      <Icon name="chevron-right" size={18} color="textSecondary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  content: {flexGrow: 1},
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  pressed: {opacity: 0.6},
  rowLabel: {flex: 1},
  version: {marginTop: spacing.xl},
});
