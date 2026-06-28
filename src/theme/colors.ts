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

  // Transparent helper
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;
