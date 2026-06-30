import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Button,
  Screen,
  ScreenHeader,
  SegmentedOptions,
  Text,
  TextField,
} from '../core/ui';
import type {SegmentedOption} from '../core/ui';
import {spacing} from '../theme';
import {submitFeedback, type FeedbackCategory} from '../core/feedback/service';
import {BackendUnavailableError} from '../core/rooms/roomService';
import type {RootStackParamList} from '../core/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Feedback'>;

const MESSAGE_MAX = 1000;

const CATEGORIES: readonly SegmentedOption<FeedbackCategory>[] = [
  {label: 'General', value: 'general'},
  {label: 'Bug', value: 'bug'},
  {label: 'Idea', value: 'idea'},
];

/**
 * Send feedback, questions, or ideas. Anonymous like the rest of the app —
 * submissions go to the Supabase `feedback` table via the submit_feedback RPC.
 */
export function FeedbackScreen({navigation}: Props) {
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = message.trim();

  const onSend = async () => {
    if (trimmed.length === 0 || sending) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      await submitFeedback(category, trimmed);
      setSent(true);
      setMessage('');
    } catch (e) {
      setError(
        e instanceof BackendUnavailableError
          ? "Can't reach the server right now. Please try again later."
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Screen>
        <ScreenHeader title="Send feedback" onBack={() => navigation.goBack()} />
        <View style={styles.done}>
          <Text variant="title" center>
            Thank you
          </Text>
          <Text variant="body" color="textSecondary" center>
            Your feedback helps shape Miflo. We read everything.
          </Text>
          <Button
            label="Send more"
            variant="secondary"
            onPress={() => setSent(false)}
            style={styles.more}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Send feedback" onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <Text variant="secondary" color="textSecondary">
          What's this about?
        </Text>
        <SegmentedOptions
          options={CATEGORIES}
          value={category}
          onChange={setCategory}
        />

        <Text variant="secondary" color="textSecondary" style={styles.label}>
          Your message
        </Text>
        <TextField
          value={message}
          onChangeText={t => {
            setMessage(t);
            setError(null);
          }}
          placeholder="Questions, bugs, or things you'd love to see"
          maxLength={MESSAGE_MAX}
          multiline
          textAlignVertical="top"
          style={styles.message}
        />

        {error && (
          <Text variant="caption" color="error">
            {error}
          </Text>
        )}

        <Button
          label={sending ? 'Sending…' : 'Send'}
          disabled={trimmed.length === 0 || sending}
          onPress={onSend}
          style={styles.send}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  label: {marginTop: spacing.lg},
  message: {
    height: 160,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  send: {marginTop: spacing.lg},
  done: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  more: {marginTop: spacing.lg},
});
