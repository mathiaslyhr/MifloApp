import React from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type Props = {
  /** Which screen edge to pin to. */
  edge: 'top' | 'bottom';
  children?: React.ReactNode;
  /**
   * Reports the bar's full height (incl. safe-area inset) so the sibling
   * ScrollView can reserve matching clearance and content scrolls *behind* the
   * bar without ever being hidden.
   */
  onHeight?: (height: number) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * A transparent, floating chrome overlay pinned to the top or bottom of a
 * screen. Nothing here draws a background — content in the underlying full-height
 * ScrollView glides behind it (the app-wide pattern first used on the Menu).
 *
 * Usage: drop the pinned edge from `<Screen edges>` (the bar owns that inset),
 * give the ScrollView `flex:1`, and pad its content by the reported height.
 * `pointerEvents="box-none"` lets scroll gestures pass through the empty areas
 * beside the actual controls.
 */
export function FloatingBar({edge, children, onHeight, style}: Props) {
  const insets = useSafeAreaInsets();
  const inset = edge === 'top' ? insets.top : insets.bottom;

  function handleLayout(e: LayoutChangeEvent) {
    onHeight?.(e.nativeEvent.layout.height);
  }

  return (
    <View
      pointerEvents="box-none"
      onLayout={handleLayout}
      style={[
        styles.bar,
        edge === 'top' ? styles.top : styles.bottom,
        edge === 'top' ? {paddingTop: inset} : {paddingBottom: inset},
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {position: 'absolute', left: 0, right: 0},
  top: {top: 0},
  bottom: {bottom: 0},
});
