import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {ChevronLeft} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Button, CircleButton, Screen, Text, TextField} from '../core/ui';
import {colors, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {joinRoom, BackendUnavailableError} from '../core/rooms/roomService';
import {randomFootballName} from '../core/identity/funnyName';

type Props = NativeStackScreenProps<RootStackParamList, 'Join'>;

const CODE_LENGTH = 4;

/**
 * Join — enter a party code to hop into someone else's lobby. Like Create, you
 * get a random football name (no prompt) and can rename yourself in the lobby.
 * On success we `replace` this screen with the Lobby so Back goes Home.
 */
export function JoinScreen({navigation}: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = code.trim();
  const canJoin = trimmed.length === CODE_LENGTH && !busy;

  async function handleJoin() {
    if (!canJoin) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const room = await joinRoom(trimmed, randomFootballName());
      navigation.replace('Lobby', {roomId: room.id});
    } catch (err) {
      setError(
        err instanceof BackendUnavailableError
          ? "Parties aren't available right now."
          : "That code didn't work. Check it and try again.",
      );
      setBusy(false);
    }
  }

  return (
    <Screen canvas>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <CircleButton
            size={36}
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        </View>
        <Text variant="wordmark" align="center">
          Join a party
        </Text>
      </View>

      <View style={styles.body}>
        <Text variant="section" align="center">
          Enter the party code
        </Text>
        <TextField
          value={code}
          onChangeText={t => {
            setCode(t.toUpperCase());
            setError(null);
          }}
          placeholder="CODE"
          autoFocus
          autoCapitalize="characters"
          maxLength={CODE_LENGTH}
          returnKeyType="go"
          onSubmitEditing={handleJoin}
          accessibilityLabel="Party code"
          style={styles.codeField}
        />
        {error ? (
          <Text variant="secondary" align="center" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Button
          label={busy ? 'Joining…' : 'Join'}
          variant="primary"
          onPress={handleJoin}
          disabled={!canJoin}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.sm,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  body: {
    paddingTop: spacing.xxxl,
    gap: spacing.lg,
  },
  codeField: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
  },
  error: {color: colors.error},
});
