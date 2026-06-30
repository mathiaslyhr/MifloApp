import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type {CompositeScreenProps} from '@react-navigation/native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Button, Screen, Text, useIslandInset} from '../core/ui';
import {colors, radii, spacing} from '../theme';
import {APP_STORE_URL} from '../core/config';
import type {
  MainTabParamList,
  RootStackParamList,
} from '../core/navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

/**
 * The landing tab. Two big actions — Create a game (jumps to the Games tab to
 * pick one) and Join a game (the shared join flow) — plus a QR code friends can
 * scan to grab Miflo from the App Store and pile in.
 */
export function HomeScreen({navigation}: Props) {
  const bottomInset = useIslandInset();

  return (
    <Screen edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, {paddingBottom: bottomInset}]}
        scrollIndicatorInsets={{bottom: bottomInset}}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title">Miflo</Text>
          <Text variant="secondary" color="textSecondary" style={styles.tagline}>
            Party games for the room you're in
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="Create a game"
            onPress={() => navigation.navigate('Games')}
          />
          <Button
            label="Join a game"
            variant="secondary"
            onPress={() => navigation.navigate('Join')}
          />
        </View>

        {/* Pins the QR card to the bottom on tall screens; collapses (and the
            page scrolls) when the content doesn't fit. */}
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  scrollContent: {
    // Fill the viewport so the spacer can push the QR card down; grow past it
    // (scroll) when the content is taller than the screen.
    flexGrow: 1,
  },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  tagline: {marginTop: spacing.xs},
  actions: {
    gap: spacing.md,
  },
  // flex:1 pushes the QR card down on tall screens; minHeight keeps a gap when
  // the content overflows and the flex space collapses to zero.
  spacer: {flex: 1, minHeight: spacing.xl},
  qrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
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
