import React from 'react';
import Svg, {Path, Circle} from 'react-native-svg';
import {colors, type ColorToken} from '../../theme';

export type IconName =
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'chevron-down'
  | 'check'
  | 'x'
  | 'layers'
  | 'share'
  | 'clock'
  | 'people'
  | 'trophy'
  | 'home'
  | 'menu'
  | 'settings'
  | 'help'
  | 'person'
  | 'chat';

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
    case 'chevron-right':
      return <Path {...common} d="M9 5l7 7-7 7" />;
    case 'chevron-up':
      return <Path {...common} d="M6 15l6-6 6 6" />;
    case 'chevron-down':
      return <Path {...common} d="M6 9l6 6 6-6" />;
    case 'check':
      return <Path {...common} d="M5 12.5l4.5 4.5L19 7" />;
    case 'x':
      return <Path {...common} d="M6 6l12 12M18 6L6 18" />;
    case 'trophy':
      return (
        <>
          <Path {...common} d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
          <Path {...common} d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
          <Path {...common} d="M10 14.5V18M14 14.5V18M8 20h8" />
        </>
      );
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
    case 'home':
      return (
        <>
          <Path {...common} d="M4 11l8-7 8 7" />
          <Path {...common} d="M6 9.5V20h12V9.5" />
          <Path {...common} d="M10 20v-5h4v5" />
        </>
      );
    case 'menu':
      return <Path {...common} d="M4 7h16M4 12h16M4 17h16" />;
    case 'settings':
      return (
        <>
          <Circle {...common} cx={12} cy={12} r={3} />
          <Path
            {...common}
            d="M12 2.5v2M12 19.5v2M4.2 7l1.7 1M18.1 16l1.7 1M4.2 17l1.7-1M18.1 8l1.7-1"
          />
        </>
      );
    case 'help':
      return (
        <>
          <Circle {...common} cx={12} cy={12} r={9} />
          <Path {...common} d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.8.4-.9.9-.9 1.7" />
          <Path {...common} d="M12 16.5h.01" />
        </>
      );
    case 'person':
      return (
        <>
          <Circle {...common} cx={12} cy={8} r={3.5} />
          <Path {...common} d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
        </>
      );
    case 'chat':
      return <Path {...common} d="M4 5h16v11H9l-4 4v-4H4V5z" />;
    default:
      return null;
  }
}
