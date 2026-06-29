/**
 * Miflo color tokens. Dark, minimal, one accent.
 * Never hardcode hex in components — import from here.
 */
export const colors = {
  // Surfaces
  background: '#000000',
  surface: '#1C1C1C', // "over background"
  divider: '#333333',

  // Accent
  primary: '#6260F6',
  onPrimary: '#E4E4FD', // secondary / on-primary (light)

  // Text
  textPrimary: '#FFFFFF', // primary / active
  textSecondary: '#9F9F9F', // secondary / inactive

  // Status
  success: '#32C36C',
  error: '#F0544A',

  // Countdown ring gradient stops (most → least time left). The ring fades
  // smoothly through these Tailwind colours as the clock runs down.
  timerHigh: '#22C55E', // Tailwind green-500 (bright green)
  timerMid: '#16A34A', // Tailwind green-600 (dark green)
  timerWarn: '#EAB308', // Tailwind yellow-500
  timerCritical: '#F97316', // Tailwind orange-500
  timerDanger: '#EF4444', // Tailwind red-500 (final stop)

  // Tinted fills (status/accent backgrounds, used behind content)
  successMuted: '#11271B', // dark-green fill behind a correct answer
  errorMuted: '#2A1414', // dark-red fill behind a wrong answer
  primaryMuted: '#1E1C45', // accent-tinted fill: selected / "you" highlight
  badgeHost: '#1E1E3A', // dark-navy pill behind the "host" badge

  // Avatars
  avatarNeutral: '#2A2A2A', // non-host avatar circle

  // Transparent helper
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;
