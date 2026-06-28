import React from 'react';
import {StyleSheet, View, type ViewStyle} from 'react-native';
import {SafeAreaView, type Edge} from 'react-native-safe-area-context';
import {colors, screenPadding} from '../../theme';

type ScreenProps = {
  children: React.ReactNode;
  /** Which safe-area edges to inset. Defaults to top + bottom. */
  edges?: readonly Edge[];
  /** Apply the default 16pt horizontal padding. Defaults to true. */
  padded?: boolean;
  style?: ViewStyle;
};

/**
 * Base screen wrapper: black background + safe-area insets (Dynamic Island,
 * home indicator) + default side padding. Every screen renders inside one.
 */
export function Screen({
  children,
  edges = ['top', 'bottom'],
  padded = true,
  style,
}: ScreenProps) {
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      <View style={[styles.content, padded && styles.padded, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: screenPadding,
  },
});
