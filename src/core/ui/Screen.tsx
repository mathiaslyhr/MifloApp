import React, {useRef} from 'react';
import {
  Keyboard,
  StyleProp,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import {Edge, SafeAreaView} from 'react-native-safe-area-context';
import {screenPadding, useColors} from '../../theme';
import {MeshBackground} from './MeshBackground';

type Props = {
  children: React.ReactNode;
  /** Render the rainbow canvas behind content (chrome screens). */
  canvas?: boolean;
  /** Solid background color when not a canvas screen (defaults to the theme `background`). */
  background?: string;
  /** Which safe-area edges to inset (defaults to all). */
  edges?: readonly Edge[];
  /** Apply default 16pt side padding (defaults true). */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A stationary press: fingers that move further/longer are scrolls, not taps. */
const TAP_SLOP = 8;
const TAP_MS = 300;

/**
 * Base screen wrapper: safe-area inset, background (solid or rainbow canvas),
 * default side padding, and tap-anywhere keyboard dismissal.
 *
 * The dismissal listens to the bubbled touch events only — it never enters
 * responder negotiation (a wrapping Touchable steals the gesture and kills
 * ScrollView panning). A short, stationary tap while typing closes the
 * keyboard unless it landed on the focused input itself (cursor moves stay).
 */
export function Screen({
  children,
  canvas = false,
  background,
  edges = ['top', 'left', 'right', 'bottom'],
  padded = true,
  style,
}: Props) {
  const colors = useColors();
  const bg = background ?? colors.background;
  const touchStart = useRef({x: 0, y: 0, at: 0});
  return (
    <View
      style={styles.root}
      onTouchStart={e => {
        touchStart.current = {
          x: e.nativeEvent.pageX,
          y: e.nativeEvent.pageY,
          at: Date.now(),
        };
      }}
      onTouchEnd={e => {
        const focused = TextInput.State.currentlyFocusedInput();
        if (!focused) {
          return;
        }
        const {pageX, pageY} = e.nativeEvent;
        const {x, y, at} = touchStart.current;
        const stationary =
          Math.abs(pageX - x) < TAP_SLOP &&
          Math.abs(pageY - y) < TAP_SLOP &&
          Date.now() - at < TAP_MS;
        if (!stationary) {
          return;
        }
        // Taps on the focused field itself move the cursor, not the keyboard.
        focused.measureInWindow((ix, iy, iw, ih) => {
          const insideInput =
            pageX >= ix && pageX <= ix + iw && pageY >= iy && pageY <= iy + ih;
          if (!insideInput) {
            Keyboard.dismiss();
          }
        });
      }}>
      {canvas ? (
        <MeshBackground />
      ) : (
        <View style={[StyleSheet.absoluteFill, {backgroundColor: bg}]} />
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
