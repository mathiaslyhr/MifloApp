import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Screen,
  ScreenHeader,
  Text,
  Button,
  SegmentedOptions,
  StickyFooter,
  TextField,
} from '../../../core/ui';
import {spacing} from '../../../theme';
import type {RootStackParamList} from '../../../core/navigation/types';
import {getNickname, setNickname} from '../../../core/identity/deviceId';
import {createRoom} from '../../../core/rooms/roomService';
import {DEFAULT_ROUND_COUNT, ROUND_COUNT_OPTIONS} from '../mockData';

type Props = NativeStackScreenProps<RootStackParamList, 'OddOneOutCreate'>;

const COUNT_OPTIONS = ROUND_COUNT_OPTIONS.map(n => ({label: String(n), value: n}));

/** Host's setup screen for Odd One Out: name + how many rounds, then create. */
export function CreateGameScreen({navigation}: Props) {
  const [name, setName] = useState('');
  const [count, setCount] = useState<number>(DEFAULT_ROUND_COUNT);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNickname().then(saved => {
      if (saved) {
        setName(saved);
      }
    });
  }, []);

  async function handleCreate() {
    const trimmed = name.trim();
    setCreating(true);
    setError(null);
    try {
      await setNickname(trimmed);
      const room = await createRoom('odd-one-out', [], count, trimmed);
      navigation.navigate('Lobby', {
        roomId: room.id,
        code: room.code,
        isHost: true,
        name: trimmed,
        gameType: 'odd-one-out',
        count,
      });
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'BackendUnavailableError'
          ? 'Online play isn’t set up yet.'
          : 'Couldn’t create the game. Check your connection and try again.',
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Odd One Out" onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text variant="secondary" color="textSecondary" style={styles.label}>
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

        <View style={styles.section}>
          <Text variant="secondary" color="textSecondary" style={styles.label}>
            Rounds
          </Text>
          <SegmentedOptions options={COUNT_OPTIONS} value={count} onChange={setCount} />
        </View>

        {error && (
          <Text variant="secondary" color="error" center>
            {error}
          </Text>
        )}
      </ScrollView>

      <StickyFooter>
        <Button
          label={creating ? 'Creating…' : 'Create game'}
          disabled={!name.trim() || creating}
          onPress={handleCreate}
        />
      </StickyFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  section: {gap: spacing.md},
  label: {marginBottom: spacing.xs},
});
