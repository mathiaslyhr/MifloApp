import React, {useMemo, useState} from 'react';
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
import {generateGameCode} from '../gameCode';
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

  const matchCount = useMemo(() => countMatchingQuestions(topicIds), [topicIds]);
  const tooFew = matchCount < count;

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
      </ScrollView>

      <StickyFooter>
        <Button
          label="Create game"
          disabled={!name.trim() || matchCount === 0}
          onPress={() =>
            navigation.navigate('QuizLobby', {
              code: generateGameCode(),
              isHost: true,
              name: name.trim(),
              topicIds,
              count,
            })
          }
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
