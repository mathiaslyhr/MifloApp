import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Avatar,
  Button,
  Icon,
  Screen,
  ScreenHeader,
  StickyFooter,
  Text,
} from '../../../core/ui';
import {colors, radii, spacing} from '../../../theme';
import type {RootStackParamList} from '../../../core/navigation/types';
import {StandingRow} from '../components/StandingRow';
import {formatPoints, type Player} from '../mockData';
import {rankContestants, type Standing} from '../scoring';
import {useQuizStore} from '../store';

type Props = NativeStackScreenProps<RootStackParamList, 'QuizPodium'>;

const BAR_HEIGHT: Record<number, number> = {1: 96, 2: 68, 3: 52};

/** Final results: top-3 podium, the rest as a list, and play-again / home. */
export function PodiumScreen({navigation, route}: Props) {
  const {roomId, code} = route.params;
  const contestants = useQuizStore(s => s.contestants);
  const topicIds = useQuizStore(s => s.topicIds);
  const total = useQuizStore(s => s.count);
  const playAgain = useQuizStore(s => s.playAgain);

  const standings = useMemo(() => rankContestants(contestants), [contestants]);

  const top3 = standings.slice(0, 3);
  const rest = standings.slice(3);
  // Display order puts the winner in the middle: 2nd · 1st · 3rd.
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const youWon = standings[0]?.contestant.isYou;

  function handlePlayAgain() {
    playAgain();
    navigation.replace('QuizQuestion', {roomId, code, topicIds, count: total});
  }

  return (
    <Screen>
      <ScreenHeader title={youWon ? 'You won!' : 'Final results'} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.podium}>
          {podiumOrder.map(standing => (
            <PodiumSpot key={standing.contestant.id} standing={standing} />
          ))}
        </View>

        {rest.length > 0 && (
          <View style={styles.rest}>
            {rest.map((standing, i) => (
              <StandingRow
                key={standing.contestant.id}
                standing={standing}
                divider={i < rest.length - 1}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <StickyFooter style={styles.footer}>
        <Button label="Play again" onPress={handlePlayAgain} />
        <Button
          label="Back to home"
          variant="secondary"
          onPress={() => navigation.popToTop()}
        />
      </StickyFooter>
    </Screen>
  );
}

function PodiumSpot({standing}: {standing: Standing}) {
  const {rank, contestant} = standing;
  const first = rank === 1;
  // Avatar treats `isHost` as the accent fill — reuse it to highlight the winner.
  const player: Player = {
    id: contestant.id,
    name: contestant.name,
    isHost: first,
  };
  return (
    <View style={styles.spot}>
      {first && <Icon name="trophy" size={22} color="primary" />}
      <Avatar
        name={player.name}
        variant={first ? 'host' : 'neutral'}
        size={first ? 64 : 52}
      />
      <Text variant="body" numberOfLines={1} style={styles.spotName}>
        {contestant.name}
      </Text>
      <Text variant="secondary" color="textSecondary">
        {formatPoints(contestant.score)}
      </Text>
      <View style={[styles.bar, {height: BAR_HEIGHT[rank] ?? 40}]}>
        <Text variant="section">{rank}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.md,
  },
  spot: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  spotName: {
    marginTop: spacing.xs,
    maxWidth: '100%',
  },
  bar: {
    marginTop: spacing.sm,
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rest: {
    marginTop: spacing.xl,
  },
  footer: {
    gap: spacing.md,
  },
});
