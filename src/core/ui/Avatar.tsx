import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, fonts} from '../../theme';

type Tone = 'accent' | 'soft' | 'surface';

const TONES: Record<Tone, {bg: string; fg: string}> = {
  accent: {bg: colors.primary, fg: colors.onInk},
  soft: {bg: 'rgba(98,96,246,0.20)', fg: colors.primaryInk},
  surface: {bg: colors.surface2, fg: colors.ink},
};

type Props = {
  initials: string;
  tone?: Tone;
  size?: number;
  /** Draw the accent "host" ring around the avatar (the Lobby host marker). */
  host?: boolean;
};

/** Gap + stroke width of the host ring. */
const RING_GAP = 3;
const RING_STROKE = 2;

/** Round initials avatar (design.md — the app-mock Avatar atom). */
export function Avatar({initials, tone = 'accent', size = 28, host = false}: Props) {
  const {bg, fg} = TONES[tone];
  const disc = (
    <View
      style={[
        styles.root,
        {width: size, height: size, borderRadius: size / 2, backgroundColor: bg},
      ]}>
      {/* Inline font (not themed Text) so size scales with the avatar. */}
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: Math.round(size * 0.43),
          color: fg,
        }}>
        {initials}
      </Text>
    </View>
  );

  if (!host) {
    return disc;
  }

  // Accent hairline ring with a small gap around the disc.
  const ring = size + (RING_GAP + RING_STROKE) * 2;
  return (
    <View
      style={[
        styles.root,
        {
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: RING_STROKE,
          borderColor: colors.primary,
        },
      ]}>
      {disc}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {alignItems: 'center', justifyContent: 'center'},
});
