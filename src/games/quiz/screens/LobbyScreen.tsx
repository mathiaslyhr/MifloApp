import React from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Screen,
  ScreenHeader,
  Text,
  Button,
  Avatar,
  Icon,
  StickyFooter,
} from '../../../core/ui';
import {colors, radii, spacing} from '../../../theme';
import type {RootStackParamList} from '../../../core/navigation/types';
import {PlayerRow} from '../components/PlayerRow';
import {DEFAULT_QUESTION_COUNT, DEFAULT_TOPIC_IDS} from '../mockData';
import {useQuizStore} from '../store';

type Props = NativeStackScreenProps<RootStackParamList, 'QuizLobby'>;

/**
 * Pre-game room: shows the game code to share, who's in the room, and (for the
 * host) the start button. Until live join lands (M3) the room is just you;
 * friends scan/enter the code to appear here.
 */
export function LobbyScreen({navigation, route}: Props) {
  const {code, isHost, name, topicIds, count} = route.params;
  // Host carries the settings; guests fall back to defaults until M3 syncs them
  // from the room.
  const questionCount = count ?? DEFAULT_QUESTION_COUNT;
  const topics = topicIds ?? DEFAULT_TOPIC_IDS;
  const subtitle = `${questionCount} questions · ${topics.length} topics`;
  const players = [{id: 'me', name, isHost, isYou: true}];
  const start = useQuizStore(s => s.start);

  function startGame() {
    start(topics, questionCount, name);
    navigation.navigate('QuizQuestion', {code, topicIds: topics, count: questionCount});
  }

  return (
    <Screen>
      <ScreenHeader
        title="Lobby"
        subtitle={subtitle}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.codeCard}>
          <Text variant="secondary" color="textSecondary" center>
            Game code
          </Text>
          <Text variant="title" center style={styles.code}>
            {code}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {}}
            style={({pressed}) => [styles.share, pressed && styles.pressed]}>
            <Icon name="share" size={18} />
            <Text variant="body" style={styles.shareLabel}>
              Share code
            </Text>
          </Pressable>
        </View>

        <View style={styles.playersHeader}>
          <Text variant="secondary" color="textSecondary">
            Players
          </Text>
          <Text variant="secondary" color="textSecondary">
            {players.length}
          </Text>
        </View>

        <View>
          {players.map(player => (
            <PlayerRow key={player.id} player={player} />
          ))}
          <View style={styles.waitingRow}>
            <Avatar variant="waiting" />
            <Text variant="body" color="textSecondary">
              waiting for more…
            </Text>
          </View>
        </View>
      </ScrollView>

      <StickyFooter>
        <Button label="Start game" onPress={startGame} />
      </StickyFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  codeCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  code: {
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: 14,
    // letter-spacing pads the right edge; nudge back to keep it centered
    marginRight: -14,
  },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  shareLabel: {
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.85,
  },
  playersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
});
