import React from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {Edge, SafeAreaView} from 'react-native-safe-area-context';
import {colors, screenPadding} from '../../theme';
import {MeshBackground} from './MeshBackground';

type Props = {
  children: React.ReactNode;
  /** Render the rainbow canvas behind content (chrome screens). */
  canvas?: boolean;
  /** Solid background color when not a canvas screen (defaults to `background`). */
  background?: string;
  /** Which safe-area edges to inset (defaults to all). */
  edges?: readonly Edge[];
  /** Apply default 16pt side padding (defaults true). */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Base screen wrapper: safe-area inset, background (solid or rainbow canvas),
 * and default side padding. Canvas screens (Home, Games, Menu, Join, Lobby,
 * Podium) pass `canvas`; gameplay/detail screens stay on a solid background.
 */
export function Screen({
  children,
  canvas = false,
  background = colors.background,
  edges = ['top', 'left', 'right', 'bottom'],
  padded = true,
  style,
}: Props) {
  return (
    <View style={styles.root}>
      {canvas ? (
        <MeshBackground />
      ) : (
        <View style={[StyleSheet.absoluteFill, {backgroundColor: background}]} />
      )}
      <SafeAreaView
        edges={edges}
        style={[
          styles.safe,
          padded && {paddingHorizontal: screenPadding},
          style,
        ]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  safe: {flex: 1},
});
