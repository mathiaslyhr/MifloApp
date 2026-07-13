/**
 * The skin 3 backdrop: the near-black canvas with a broad purple `primary` bloom
 * anchored near the top. Shared by the welcome screen and the quick-setup flow so
 * every skin 3 entry screen sits on the same light. Renders its children on top.
 */
import React from 'react';
import {Dimensions, StatusBar, StyleSheet, View} from 'react-native';
import Svg, {Defs, RadialGradient, Rect, Stop} from 'react-native-svg';
import {useColors, useThemedStyles, type Palette} from '../../theme';

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');
/** Glow height — reaches past mid-screen so the bloom fades out low. */
const GLOW_H = Math.round(SCREEN_H * 0.62);

export function GlowBackground({children}: {children: React.ReactNode}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View pointerEvents="none" style={styles.glow}>
        <Svg width={SCREEN_W} height={GLOW_H}>
          <Defs>
            <RadialGradient id="skinGlow" cx="56%" cy="2%" rx="96%" ry="82%">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={0.95} />
              <Stop offset="0.38" stopColor={colors.primary} stopOpacity={0.52} />
              <Stop offset="0.74" stopColor={colors.primary} stopOpacity={0.14} />
              <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={SCREEN_W} height={GLOW_H} fill="url(#skinGlow)" />
        </Svg>
      </View>
      {children}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: c.background},
    glow: {position: 'absolute', top: 0, left: 0, right: 0},
  });
