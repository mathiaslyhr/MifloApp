import React from 'react';
import Svg, {Path, Circle} from 'react-native-svg';
import {colors, type ColorToken} from '../../theme';

export type IconName =
  | 'chevron-left'
  | 'chevron-up'
  | 'chevron-down'
  | 'check'
  | 'layers'
  | 'share'
  | 'clock'
  | 'people';

type IconProps = {
  name: IconName;
  /** Square size in points. Defaults to 20. */
  size?: number;
  /** Stroke color token. Defaults to `textPrimary`. */
  color?: ColorToken;
  strokeWidth?: number;
};

/**
 * Hand-rolled line icons (24×24 grid, stroke-based) covering the small set the
 * quiz screens need. Keeps us off a heavyweight icon dependency — add a glyph
 * to `IconName` and the switch below when a screen needs a new one.
 */
export function Icon({
  name,
  size = 20,
  color = 'textPrimary',
  strokeWidth = 2,
}: IconProps) {
  const stroke = colors[color];
  const common = {
    stroke,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderGlyph(name, common)}
    </Svg>
  );
}

function renderGlyph(name: IconName, common: object): React.ReactNode {
  switch (name) {
    case 'chevron-left':
      return <Path {...common} d="M15 5l-7 7 7 7" />;
    case 'chevron-up':
      return <Path {...common} d="M6 15l6-6 6 6" />;
    case 'chevron-down':
      return <Path {...common} d="M6 9l6 6 6-6" />;
    case 'check':
      return <Path {...common} d="M5 12.5l4.5 4.5L19 7" />;
    case 'layers':
      return (
        <>
          <Path {...common} d="M12 3l9 5-9 5-9-5 9-5z" />
          <Path {...common} d="M3 13l9 5 9-5" />
        </>
      );
    case 'share':
      return (
        <>
          <Circle {...common} cx={18} cy={5} r={3} />
          <Circle {...common} cx={6} cy={12} r={3} />
          <Circle {...common} cx={18} cy={19} r={3} />
          <Path {...common} d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
        </>
      );
    case 'clock':
      return (
        <>
          <Circle {...common} cx={12} cy={12} r={9} />
          <Path {...common} d="M12 7v5l3.5 2" />
        </>
      );
    case 'people':
      return (
        <>
          <Circle {...common} cx={9} cy={8} r={3.5} />
          <Path {...common} d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
          <Path {...common} d="M16 5.2a3.5 3.5 0 0 1 0 6.6" />
          <Path {...common} d="M18 14.2a5 5 0 0 1 3 4.6V20" />
        </>
      );
    default:
      return null;
  }
}
