import React from 'react';
import {StyleSheet, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Screen, Text, Button} from '../core/ui';
import {colors, radii, spacing} from '../theme';
import {APP_STORE_URL} from '../core/config';
import type {RootStackParamList} from '../core/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/**
 * The front page. Two primary actions — host a game or join one — plus a QR
 * code friends can scan to grab Miflo from the App Store and pile in.
 */
export function HomeScreen({navigation}: Props) {
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Miflo</Text>
        <Text variant="secondary" color="textSecondary" style={styles.tagline}>
          Party games for the room you're in
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Create game"
          onPress={() => navigation.navigate('QuizCreate')}
        />
        <Button
          label="Join game"
          variant="secondary"
          onPress={() => navigation.navigate('QuizJoin')}
        />
      </View>

      <View style={styles.spacer} />

      <View style={styles.qrCard}>
        <View style={styles.qrFrame}>
          <QRCode
            value={APP_STORE_URL}
            size={88}
            backgroundColor="white"
            color="black"
          />
        </View>
        <View style={styles.qrText}>
          <Text variant="body" style={styles.qrTitle}>
            Scan to get Miflo
          </Text>
          <Text variant="secondary" color="textSecondary">
            Send the app to friends so they can join
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  tagline: {marginTop: spacing.xs},
  actions: {
    gap: spacing.md,
  },
  spacer: {flex: 1},
  qrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  qrFrame: {
    backgroundColor: 'white',
    borderRadius: radii.button,
    padding: spacing.sm,
  },
  qrText: {
    flex: 1,
    gap: spacing.xs,
  },
  qrTitle: {fontWeight: '500'},
});
