import React from 'react';
import {StyleProp, View, ViewStyle} from 'react-native';
import {radii, shadows, useColors} from '../../theme';

type Props = {
  children?: React.ReactNode;
  /** Exact fill override for surfaces that need their own tint. */
  tintColor?: string;
  /** Ambient lift. Most in-flow cards sit flush (`'none'`). */
  shadow?: 'none' | 'soft' | 'floating';
  radius?: 'card' | 'pill';
  borderWidth?: number;
  borderColor?: string;
  /** Padding, gap, layout, overflow, or a bespoke shadow live at the call site. */
  style?: StyleProp<ViewStyle>;
};

/**
 * The shared card surface (design.md §5): solid surface-1 fill with the
 * standard hairline border, one step lighter than the fill. Every card in the
 * app reads from this recipe so the material stays one piece across screens.
 */
export function Card({
  children,
  tintColor,
  shadow = 'none',
  radius = 'card',
  borderWidth = 1,
  borderColor,
  style,
}: Props) {
  const colors = useColors();
  const frame: ViewStyle = {
    borderRadius: radii[radius],
    borderWidth,
    borderColor: borderColor ?? colors.divider,
    backgroundColor: tintColor ?? colors.surface,
  };
  const lift = shadow === 'none' ? undefined : shadows[shadow];
  return <View style={[frame, lift, style]}>{children}</View>;
}
