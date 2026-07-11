import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
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
  /** Profile picture URL. When set (and it loads), the photo replaces the
   * initials; a null URL or a load failure falls back to initials. */
  uri?: string | null;
};

/** Gap + stroke width of the host ring. */
const RING_GAP = 3;
const RING_STROKE = 2;

/** Up to two initials from a display name — the one recipe every avatar uses. */
export function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Round initials avatar (design.md — the app-mock Avatar atom), or a profile
 * photo when `uri` is set and loads. */
export function Avatar({
  initials,
  tone = 'accent',
  size = 28,
  host = false,
  uri,
}: Props) {
  const {bg, fg} = TONES[tone];
  // Fall back to initials if the photo fails to load (stale/broken URL).
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [uri]);
  const showPhoto = !!uri && !failed;

  const disc = (
    <View
      style={[
        styles.root,
        styles.clip,
        {width: size, height: size, borderRadius: size / 2, backgroundColor: bg},
      ]}>
      {showPhoto ? (
        <Image
          source={{uri: uri!}}
          style={{width: size, height: size}}
          onError={() => setFailed(true)}
        />
      ) : (
        // Inline font (not themed Text) so size scales with the avatar.
        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: Math.round(size * 0.43),
            color: fg,
          }}>
          {initials}
        </Text>
      )}
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
