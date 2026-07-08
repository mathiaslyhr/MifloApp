import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {
  Button,
  CircleButton,
  NAV_HEIGHT,
  QrCard,
  Screen,
  Text,
  toast,
} from '../core/ui';
import {APP_STORE_URL} from '../core/config';
import {spacing} from '../theme';
import {useAppNavigation} from '../core/navigation';
import {createRoom, BackendUnavailableError} from '../core/rooms/roomService';
import {randomFootballName} from '../core/identity/funnyName';

/** Placeholder game type: a room is created game-less; the host picks in the lobby. */
const NO_GAME_YET = 'unset';

/**
 * Home — the clean launch hub on the rainbow canvas. A centered Miflo wordmark
 * with a "how it works" help button in the top-right corner; the two room CTAs
 * sit in the upper area; a real QR to the App Store anchors the bottom, clearing
 * the shared nav island (which the tab shell pins over the bottom).
 *
 * "Create a room" mints a room instantly with a random funny football name (no
 * prompt — you rename yourself in the lobby by tapping your avatar) with no game
 * chosen yet, and pushes the Lobby where the host later picks the game. "Join a
 * room" and the help sheet are wired in later passes.
 */
export function HomeScreen() {
  const navigation = useAppNavigation();
  const {t} = useTranslation();
  const [busy, setBusy] = useState(false);

  // Create a room under a random football name, then hand off to the Lobby.
  async function handleCreate() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const room = await createRoom(NO_GAME_YET, [], 0, randomFootballName());
      navigation.navigate('Lobby', {roomId: room.id});
    } catch (err) {
      toast.error(
        err instanceof BackendUnavailableError
          ? t('home.errorUnavailable')
          : t('home.errorCreate'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen canvas>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            Miflo
          </Text>
          <View style={styles.headerRight}>
            <CircleButton
              size={30}
              accessibilityLabel={t('home.help')}
              onPress={() => navigation.navigate('HowToPlay')}>
              <Text variant="secondary" color="secondary">
                ?
              </Text>
            </CircleButton>
          </View>
        </View>

        <View style={styles.topSpacer} />

        <View style={styles.actions}>
          <Button
            label={busy ? t('home.creating') : t('home.createParty')}
            variant="primary"
            onPress={handleCreate}
            disabled={busy}
          />
          <Button
            label={t('home.joinParty')}
            variant="secondary"
            onPress={() => navigation.navigate('Join')}
          />
        </View>

        <View style={styles.bottomSpacer} />

        <View style={styles.qr}>
          <QrCard value={APP_STORE_URL} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Reserve room at the bottom for the shell's floating nav island.
  content: {flex: 1, paddingBottom: NAV_HEIGHT},
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
