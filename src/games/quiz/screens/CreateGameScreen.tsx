import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Screen,
  ScreenHeader,
  Text,
  Button,
  Chip,
  SegmentedOptions,
  StickyFooter,
  TextField,
  Icon,
} from '../../../core/ui';
import {spacing} from '../../../theme';
import type {RootStackParamList} from '../../../core/navigation/types';
import {getNickname, setNickname} from '../../../core/identity/deviceId';
import {createRoom} from '../../../core/rooms/roomService';
import {
  TOPICS,
  QUESTION_COUNT_OPTIONS,
  DEFAULT_QUESTION_COUNT,
  DEFAULT_TOPIC_IDS,
} from '../mockData';
import {countMatchingQuestions} from '../questions';

type Props = NativeStackScreenProps<RootStackParamList, 'QuizCreate'>;

const COUNT_OPTIONS = QUESTION_COUNT_OPTIONS.map(n => ({
  label: String(n),
  value: n,
}));

/**
 * Host's setup screen: pick how many questions and which topics, see how many
 * questions match, then create the room. Static for M1 — selections aren't
 * persisted yet.
 */
export function CreateGameScreen({navigation}: Props) {
  const [name, setName] = useState('');
  const [count, setCount] = useState<number>(DEFAULT_QUESTION_COUNT);
  const [topicIds, setTopicIds] = useState<string[]>(DEFAULT_TOPIC_IDS);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill the name from the last game so returning hosts don't retype it.
  useEffect(() => {
    getNickname().then(saved => {
      if (saved) {
        setName(saved);
      }
    });
  }, []);

  const matchCount = useMemo(() => countMatchingQuestions(topicIds), [topicIds]);
  const tooFew = matchCount < count;

  async function handleCreate() {
    const trimmed = name.trim();
    setCreating(true);
    setError(null);
    try {
      await setNickname(trimmed);
      const room = await createRoom(topicIds, count, trimmed);
      navigation.navigate('QuizLobby', {
        roomId: room.id,
        code: room.code,
        isHost: true,
        name: trimmed,
        topicIds,
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

  function toggleTopic(id: string) {
    if (id === 'all') {
      setTopicIds(['all']);
      return;
    }
    setTopicIds(prev => {
      const withoutAll = prev.filter(t => t !== 'all');
      return withoutAll.includes(id)
        ? withoutAll.filter(t => t !== id)
        : [...withoutAll, id];
    });
  }

  return (
    <Screen>
      <ScreenHeader title="Create game" onBack={() => navigation.goBack()} />
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
            Question count
          </Text>
          <SegmentedOptions
            options={COUNT_OPTIONS}
            value={count}
            onChange={setCount}
          />
        </View>

        <View style={styles.section}>
          <Text variant="secondary" color="textSecondary" style={styles.label}>
            Topics
          </Text>
          <View style={styles.chips}>
            {TOPICS.map(topic => (
              <Chip
                key={topic.id}
                label={topic.label}
                selected={topicIds.includes(topic.id)}
                disabled={topicIds.includes('all') && topic.id !== 'all'}
                onPress={() => toggleTopic(topic.id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.infoRow}>
          <Icon name="layers" size={18} color="textSecondary" />
          <Text variant="secondary" color="textSecondary">
            {matchCount} questions match your topics
            {tooFew ? ` · only ${matchCount} will be used` : ''}
          </Text>
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
          disabled={!name.trim() || matchCount === 0 || creating}
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
  section: {
    gap: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
