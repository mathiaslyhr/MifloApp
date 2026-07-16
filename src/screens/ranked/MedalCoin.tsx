/**
 * The podium's coin: a struck gold / silver / bronze disc carrying the rank
 * digit, for places 1, 2 and 3.
 *
 * It replaced a full-row metal wash, and the coin is better for a reason worth
 * keeping: a wash has to stay dim, because the row's near-white name, € and
 * meta all sit on top of it, and a dim gold over near-black desaturates into
 * olive. A coin owns its pixels. It can be FULLY saturated metal with a dark
 * digit struck into it — which is both what a medal actually looks like and, at
 * ~11:1, far more legible than the wash ever was.
 *
 * "Colour is reserved for meaning" (design.md) holds: gold means first. It is
 * the one hue in the app that brings its meaning from outside the app, which is
 * why these are constants rather than palette tokens — gold is gold in every
 * skin, and a theme has no opinion about it. The gradient is not the purged
 * frost either ([[no-frost-design-shift]] was about blur and translucency over
 * content): this is opaque, and it's the same react-native-svg LinearGradient
 * the € ValueChart already uses.
 *
 * Nothing animates. A travelling glint would be a loop, and loops don't survive
 * Reduce Motion (theme/motion.ts); the raking band reads as polish while still.
 */
import React, {useId} from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Defs, LinearGradient, Stop} from 'react-native-svg';
import {Text} from '../../core/ui';
import {fonts} from '../../theme';

export type Medal = 1 | 2 | 3;

/**
 * Each metal as a struck disc: `light` catches the light, `base` is the body,
 * `dark` is the shaded rim, `ink` is the digit stamped into it.
 */
const COIN: Record<Medal, {light: string; base: string; dark: string; ink: string}> = {
  1: {light: '#FFF1B8', base: '#FFC400', dark: '#9A6B00', ink: '#4A3400'},
  2: {light: '#FFFFFF', base: '#CFD9E4', dark: '#7C8894', ink: '#2B323C'},
  3: {light: '#FFD3A6', base: '#D2823C', dark: '#7C4A1A', ink: '#3F2208'},
};

/** Diameter. Sized against the 36pt avatar beside it: clearly a token, not a badge. */
export const COIN_SIZE = 26;

export function MedalCoin({medal, rank}: {medal: Medal; rank: number}) {
  const id = useId();
  const {light, base, dark, ink} = COIN[medal];
  const r = COIN_SIZE / 2;
  return (
    <View style={styles.coin}>
      <Svg width={COIN_SIZE} height={COIN_SIZE} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Diagonal: lit from the top-left, shaded to the bottom-right, with a
              narrow band raking across the middle. Narrow reads as polish; wide
              just reads as a gradient. */}
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset={0} stopColor={light} />
            <Stop offset={0.38} stopColor={base} />
            <Stop offset={0.5} stopColor={light} />
            <Stop offset={0.58} stopColor={base} />
            <Stop offset={1} stopColor={dark} />
          </LinearGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#${id})`} />
      </Svg>
      <Text style={[styles.digit, {color: ink}]}>{rank}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  coin: {
    width: COIN_SIZE,
    height: COIN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Not a type-scale variant: this is a digit struck into metal, sized to the
  // disc rather than to the text ladder.
  digit: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
});
