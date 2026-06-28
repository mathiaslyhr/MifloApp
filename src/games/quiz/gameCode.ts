/**
 * Short, human-friendly room codes. Excludes easily-confused characters
 * (0/O, 1/I) so codes are easy to read aloud and type. M1 generates these
 * client-side; M3 will mint them server-side and guarantee uniqueness.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateGameCode(length = 4): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return code;
}
