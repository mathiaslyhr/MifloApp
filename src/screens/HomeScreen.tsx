import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Button, GameTile, Screen, Text} from '../core/ui';
import {colors, radii, spacing} from '../theme';
import {APP_STORE_URL} from '../core/config';
import {games} from '../games/registry';
import type {RootStackParamList} from '../core/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/**
 * The front page. A tile per registered game (host flow), a single "Join game"
 * action, plus a QR code friends can scan to grab Miflo from the App Store and
 * pile in. The hub is game-agnostic — it renders whatever the registry lists.
 */
export function HomeScreen({navigation}: Props) {
  return (
    <Screen>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title">Miflo</Text>
          <Text variant="secondary" color="textSecondary" style={styles.tagline}>
            Party games for the room you're in
          </Text>
        </View>

        <View style={styles.actions}>
          {games.map(game => (
            <GameTile
              key={game.id}
              game={game}
              onPress={() => navigation.navigate(game.entryRoute)}
            />
          ))}
          <Button
            label="Join game"
            variant="secondary"
            onPress={() => navigation.navigate('Join')}
          />
        </View>

        {/* Pins the QR card to the bottom on tall screens; collapses (and the
            page scrolls) when the games + card don't fit. */}
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
    paddingBottom: spacing.lg,
  },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
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
