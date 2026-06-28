import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Screen, Text} from './index';
import {spacing} from '../../theme';

/**
 * Temporary screen stub used during M0 so navigation is fully wired before
 * the real UI lands in M1. Each milestone replaces these.
 */
export function Placeholder({title, note}: {title: string; note?: string}) {
  return (
    <Screen>
      <View style={styles.center}>
        <Text variant="title" center>
          {title}
        </Text>
        <Text variant="secondary" color="textSecondary" center style={styles.note}>
          {note ?? 'Coming in the next milestone'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {marginTop: spacing.sm},
});
