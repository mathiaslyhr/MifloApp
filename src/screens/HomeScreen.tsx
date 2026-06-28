import React from 'react';
import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Screen, Text, Button} from '../core/ui';
import {GameTile} from '../core/ui/GameTile';
import {spacing} from '../theme';
import {games} from '../games/registry';
import type {RootStackParamList} from '../core/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/**
 * The launcher/hub. App-level and game-agnostic: it lists whatever games are
 * registered and routes to each game's entry screen. For v1 that's the
 * football quiz; more tiles drop in later.
 */
export function HomeScreen({navigation}: Props) {
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Miflo</Text>
        <Text variant="secondary" color="textSecondary" style={styles.tagline}>
          Party games for the room you're in
        </Text>
      </View>

      <View style={styles.list}>
        {games.map(game => (
          <GameTile
            key={game.id}
            game={game}
            onPress={() => navigation.navigate(game.entryRoute)}
          />
        ))}
      </View>

      <Button
        label="Join a game"
        variant="secondary"
        onPress={() => navigation.navigate('QuizJoin')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  tagline: {marginTop: spacing.xs},
  list: {
    flex: 1,
    gap: spacing.md,
  },
});
