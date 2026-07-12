import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MaskedView from '@react-native-masked-view/masked-view';
import {BlurView} from '@react-native-community/blur';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {useSkin} from '../../theme';

/** How far the blur fades below the solid region before it's fully gone. */
const FADE_TAIL = 28;

type Props = {
  /**
   * Height of the fully-frosted region before the fade begins. Defaults to the
   * status-bar inset (scroll-away hubs). Pass a taller value to keep the frost
   * solid through a pinned header (menu detail pages) before it dissolves.
   */
  solidHeight?: number;
  /** How far the blur ramps to transparent below the solid region. */
  tail?: number;
};

/**
 * The seamless top status backdrop for scroll-away pages. A real backdrop blur
 * masked by a vertical gradient: fully frosted behind the clock/battery, then
 * fading to nothing over the last ~28px — so content scrolling underneath melts
 * away instead of being clipped by a hard edge (the Instagram feel). A plain
 * `BlurView` rectangle here reads as an orphaned band with a visible seam; the
 * fade removes it.
 *
 * `pointerEvents="none"` so scroll gestures pass straight through to the list.
 */
export function TopStatusFade({solidHeight, tail = FADE_TAIL}: Props = {}) {
  const insets = useSafeAreaInsets();
  const {skin, colors} = useSkin();
  const solidH = solidHeight ?? insets.top;
  const height = solidH + tail;
  // Hold full opacity through the solid region, then ramp to transparent.
  const solid = solidH / height;

  return (
    <View pointerEvents="none" style={[styles.container, {height}]}>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset={0} stopColor="#000" stopOpacity={1} />
                <Stop offset={solid} stopColor="#000" stopOpacity={1} />
                <Stop offset={1} stopColor="#000" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#topFade)" />
          </Svg>
        }>
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType={skin.appearance === 'dark' ? 'dark' : 'light'}
          blurAmount={18}
          reducedTransparencyFallbackColor={colors.glassStrong}
        />
      </MaskedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {position: 'absolute', top: 0, left: 0, right: 0},
});
