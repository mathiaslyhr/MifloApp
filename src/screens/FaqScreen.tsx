import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Screen, ScreenHeader, Text} from '../core/ui';
import {colors, radii, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Faq'>;

const FAQS: {q: string; a: string}[] = [
  {
    q: 'How do rooms work?',
    a: 'One person hosts a game and gets a short room code. Everyone else taps Join a game, enters the code, and plays together on their own phones.',
  },
  {
    q: 'What games are there?',
    a: 'Football Quiz — trivia with your mates. Odd One Out — four options, one breaks the pattern. Missing XI — name the missing player from an iconic line-up.',
  },
  {
    q: 'How does scoring work?',
    a: 'Right answers score points, and answering faster scores more. The podium at the end ranks everyone, and your results are saved to Your stats.',
  },
  {
    q: 'Do my friends need the app?',
    a: 'Yes — everyone plays on their own phone. Share the QR code on the Home tab so friends can grab Miflo and join your room.',
  },
];

/** Static "how to play" help, pushed from the Menu. */
export function FaqScreen({navigation}: Props) {
  return (
    <Screen>
      <ScreenHeader title="How to play" onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {FAQS.map(item => (
          <View key={item.q} style={styles.card}>
            <Text variant="body" style={styles.question}>
              {item.q}
            </Text>
            <Text variant="secondary" color="textSecondary">
              {item.a}
            </Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  question: {fontWeight: '500'},
});
