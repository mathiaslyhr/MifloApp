import React from 'react';
import {Linking, Pressable, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Icon, Screen, ScreenHeader, Text} from '../core/ui';
import {colors, radii, spacing} from '../theme';
import {APP_VERSION, PRIVACY_POLICY_URL} from '../core/config';
import type {RootStackParamList} from '../core/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

/** App settings: version, privacy policy, and room for future toggles. */
export function SettingsScreen({navigation}: Props) {
  return (
    <Screen>
      <ScreenHeader title="Settings" onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <View style={styles.group}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Privacy policy"
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            style={({pressed}) => [styles.row, pressed && styles.pressed]}>
            <Text variant="body" style={styles.rowLabel}>
              Privacy policy
            </Text>
            <Icon name="chevron-right" size={18} color="textSecondary" />
          </Pressable>
        </View>

        <View style={styles.row}>
          <Text variant="body" color="textSecondary" style={styles.rowLabel}>
            Version
          </Text>
          <Text variant="body" color="textSecondary">
            {APP_VERSION}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  pressed: {opacity: 0.6},
  rowLabel: {flex: 1},
});
