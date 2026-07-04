import React from 'react';
import {StyleSheet, View} from 'react-native';
import {
  Button,
  CircleButton,
  IslandTabBar,
  QrCard,
  Screen,
  TabId,
  Text,
} from '../core/ui';
import {APP_STORE_URL} from '../core/config';
import {spacing} from '../theme';

/**
 * Home — the clean launch hub on the rainbow canvas. A centered Miflo wordmark
 * with a "how it works" help button in the top-right corner; the two room CTAs
 * sit in the upper area; a real QR to the App Store anchors the bottom, with the
 * floating nav island (Home active) below it.
 *
 * The Create/Join buttons and the help button carry the shared press-feel now;
 * their destinations (Create/Join screens, the "How it works" sheet) are wired
 * in later passes.
 */
type Props = {
  /** Switch tabs (the nav island). */
  onTabSelect?: (id: TabId) => void;
};

export function HomeScreen({onTabSelect}: Props) {
  return (
    <Screen canvas>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            Miflo
          </Text>
          <View style={styles.headerRight}>
            <CircleButton size={30} accessibilityLabel="How it works">
              <Text variant="secondary" color="secondary">
                ?
              </Text>
            </CircleButton>
          </View>
        </View>

        <View style={styles.topSpacer} />

        <View style={styles.actions}>
          <Button label="Create a room" variant="primary" />
          <Button label="Join a room" variant="secondary" />
        </View>

        <View style={styles.bottomSpacer} />

        <View style={styles.qr}>
          <QrCard value={APP_STORE_URL} />
        </View>

        <IslandTabBar active="home" onSelect={onTabSelect} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {flex: 1},
  header: {
    marginTop: spacing.sm,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  // Buttons sit ~a third down (a bit below the top, not centered).
  topSpacer: {flex: 1},
  actions: {gap: spacing.sm + 2},
  bottomSpacer: {flex: 1.7},
  qr: {alignItems: 'center', marginBottom: spacing.sm},
});
