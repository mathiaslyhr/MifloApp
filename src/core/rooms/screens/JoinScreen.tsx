import React, {useEffect, useState} from 'react';
import {KeyboardAvoidingView, Platform, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Screen,
  ScreenHeader,
  Text,
  Button,
  TextField,
  StickyFooter,
} from '../../ui';
import {spacing} from '../../../theme';
import type {RootStackParamList} from '../../navigation/types';
import {getNickname, setNickname} from '../../identity/deviceId';
import {joinRoom} from '../roomService';

type Props = NativeStackScreenProps<RootStackParamList, 'Join'>;

/**
 * Shared guest entry for every game: type the host's game code and a display
 * name, then join the real room. The room carries its own game type, so the
 * lobby (and from there the right game) is discovered, not chosen here. An
 * unknown/closed code surfaces inline without navigating.
 */
export function JoinScreen({navigation}: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill the name from the last game.
  useEffect(() => {
    getNickname().then(saved => {
      if (saved) {
        setName(saved);
      }
    });
  }, []);

  const canJoin = code.trim().length === 4 && name.trim().length > 0 && !joining;

  async function handleJoin() {
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    setJoining(true);
    setError(null);
    try {
      await setNickname(trimmedName);
      const room = await joinRoom(trimmedCode, trimmedName);
      navigation.navigate('Lobby', {
        roomId: room.id,
        code: room.code,
        isHost: false,
        name: trimmedName,
        gameType: room.gameType,
      });
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'BackendUnavailableError'
          ? 'Online play isn’t set up yet.'
          : 'Invalid or closed code',
      );
    } finally {
      setJoining(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Join game" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.field}>
            <Text variant="secondary" color="textSecondary">
              Game code
            </Text>
            <TextField
              variant="code"
              value={code}
              onChangeText={text => setCode(text.toUpperCase().slice(0, 4))}
              placeholder="––––"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={4}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text variant="secondary" color="textSecondary">
              Your name
            </Text>
            <TextField
              value={name}
              onChangeText={setName}
              placeholder="Name"
              autoCapitalize="words"
              maxLength={16}
              returnKeyType="done"
            />
          </View>

          {error && (
            <Text variant="secondary" color="error">
              {error}
            </Text>
          )}
        </View>

        <StickyFooter>
          <Button
            label={joining ? 'Joining…' : 'Join game'}
            disabled={!canJoin}
            onPress={handleJoin}
          />
        </StickyFooter>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
  content: {
    flex: 1,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  field: {
    gap: spacing.md,
  },
});
