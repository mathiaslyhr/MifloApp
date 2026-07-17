/**
 * Renders a chip's art: a bundled Metro asset (number, never fails) or an
 * over-the-air `{uri}` (crest/flag/portrait this binary lacks). If a remote
 * image fails to load — offline and not yet cached — it degrades to the emoji
 * fallback, exactly as a country without any bundled flag does. Mirrors the
 * onError → fallback pattern in core/ui/Avatar.tsx.
 */
import React from 'react';
import {
  Image,
  Text,
  type ImageResizeMode,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import type {ChipImage} from '../criterionIcon';

type Props = {
  image: ChipImage;
  /** Emoji/text shown when there is no image, or a remote one fails to load. */
  emoji?: string | null;
  imageStyle?: StyleProp<ImageStyle>;
  emojiStyle?: StyleProp<TextStyle>;
  resizeMode?: ImageResizeMode;
};

/** Our OTA sources are always a plain `{uri}` object; a bundled asset is an
 * opaque Metro id (a number under Metro). Detect remote by the uri key so the
 * distinction holds in every environment, incl. jest's object asset mocks. */
function remoteUri(image: ChipImage): string | null {
  return image != null && typeof image === 'object' && 'uri' in image
    ? (image as {uri?: string}).uri ?? null
    : null;
}

export function ArtIcon({image, emoji, imageStyle, emojiStyle, resizeMode = 'contain'}: Props) {
  const [failed, setFailed] = React.useState(false);
  const uri = remoteUri(image);
  // Key on the uri string (a remote `{uri}` object is rebuilt every render, so
  // keying on identity would reset the error state in a loop).
  React.useEffect(() => setFailed(false), [uri]);

  const isRemote = uri != null;
  if (image != null && !(isRemote && failed)) {
    return (
      <Image
        source={image}
        resizeMode={resizeMode}
        style={imageStyle}
        onError={isRemote ? () => setFailed(true) : undefined}
      />
    );
  }
  return emoji ? <Text style={emojiStyle}>{emoji}</Text> : null;
}
