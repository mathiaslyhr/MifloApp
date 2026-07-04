import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

/**
 * Blank slate. The old frontend was torn out; this is the single landing page
 * the new frontend + flow will be built on top of. Deliberately plain — no
 * design system, no navigation, no theme — so nothing biases the rebuild.
 */
export function HomeScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Miflo</Text>
      <Text style={styles.tagline}>Party games for the room you're in</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: '600',
    color: '#111111',
  },
  tagline: {
    marginTop: 8,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
});
