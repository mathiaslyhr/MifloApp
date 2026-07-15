/**
 * Scroll-aware solid-colour edge fades (no blur): the canvas colour ramps to
 * transparent over a scroller's top/bottom edge so content dissolves into the
 * background instead of hard-cutting against pinned chrome. Each scrim only
 * shows when there's content scrolled past that edge, so the first/last item
 * is never dimmed at rest.
 *
 * Usage:
 *   const fades = useEdgeFades();
 *   <ScrollView
 *     onScroll={fades.onScroll}
 *     onLayout={fades.onLayout}
 *     onContentSizeChange={fades.onContentSizeChange}
 *     scrollEventThrottle={16}
 *   />
 *   <EdgeFade edge="top" opacity={fades.topOpacity} />
 *   <EdgeFade edge="bottom" opacity={fades.bottomOpacity} />
 */
import React, {useRef} from 'react';
import {
  Animated,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {useColors} from '../../theme';

/** Height of each edge-fade scrim. */
export const EDGE_FADE_HEIGHT = 36;

export function useEdgeFades() {
  const topOpacity = useRef(new Animated.Value(0)).current;
  const bottomOpacity = useRef(new Animated.Value(0)).current;
  const topShown = useRef(false);
  const bottomShown = useRef(false);
  const viewportH = useRef(0);
  const contentH = useRef(0);
  const lastOffsetY = useRef(0);

  function toggle(
    value: Animated.Value,
    shownRef: React.MutableRefObject<boolean>,
    show: boolean,
  ) {
    if (shownRef.current === show) {
      return;
    }
    shownRef.current = show;
    Animated.timing(value, {
      toValue: show ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }

  function refresh(offsetY: number) {
    const maxY = Math.max(0, contentH.current - viewportH.current);
    toggle(topOpacity, topShown, offsetY > 2);
    toggle(bottomOpacity, bottomShown, offsetY < maxY - 2);
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    lastOffsetY.current = e.nativeEvent.contentOffset.y;
    refresh(lastOffsetY.current);
  };
  const onLayout = (e: LayoutChangeEvent) => {
    viewportH.current = e.nativeEvent.layout.height;
    refresh(lastOffsetY.current);
  };
  const onContentSizeChange = (_w: number, h: number) => {
    contentH.current = h;
    refresh(lastOffsetY.current);
  };

  return {topOpacity, bottomOpacity, onScroll, onLayout, onContentSizeChange};
}

export function EdgeFade({
  edge,
  opacity,
  height = EDGE_FADE_HEIGHT,
}: {
  edge: 'top' | 'bottom';
  opacity: Animated.Value;
  height?: number;
}) {
  const colors = useColors();
  const top = edge === 'top';
  const gradId = `edgeFade-${edge}`;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.fade,
        top ? styles.top : styles.bottom,
        {height, opacity},
      ]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={colors.background} stopOpacity={top ? 1 : 0} />
            <Stop offset={1} stopColor={colors.background} stopOpacity={top ? 0 : 1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fade: {position: 'absolute', left: 0, right: 0},
  top: {top: 0},
  bottom: {bottom: 0},
});
