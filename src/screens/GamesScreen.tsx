import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import type {CompositeScreenProps} from '@react-navigation/native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {GameTile, Screen, Text, useIslandInset} from '../core/ui';
import {spacing} from '../theme';
import {games} from '../games/registry';
import type {
  MainTabParamList,
  RootStackParamList,
} from '../core/navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Games'>,
  NativeStackScreenProps<RootStackParamList>
>;

/**
 * The game picker. A tile per registered game; tapping one pushes that game's
 * create flow onto the root stack (above the tabs). The list is game-agnostic —
 * it renders whatever the registry lists.
 */
export function GamesScreen({navigation}: Props) {
  const bottomInset = useIslandInset();

  return (
    <Screen edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, {paddingBottom: bottomInset}]}
        scrollIndicatorInsets={{bottom: bottomInset}}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title">Games</Text>
          <Text variant="secondary" color="textSecondary" style={styles.tagline}>
            Pick one to host for the room
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  content: {flexGrow: 1},
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  tagline: {marginTop: spacing.xs},
  list: {gap: spacing.md},
});
