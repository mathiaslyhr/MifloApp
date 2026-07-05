/**
 * Random funny football usernames. Miflo assigns one the moment you create or
 * join a party, so you're straight in — no name prompt. You can tap yourself in
 * the lobby to change it, but half the fun is guessing who "Lionel Messiah" is.
 *
 * Two sources, mixed ~50/50 for variety:
 *  - CURATED: FIFA Ultimate Team / Pro Clubs-style pun names (the good stuff).
 *  - COMBINATORIAL: adjective + noun mash-ups for near-endless variety.
 *
 * All kept ≤ 20 chars to fit the player-name cap (`rename_player`) and the
 * lobby name tags. Add more freely.
 */

/** Curated one-liners — football puns and joke names. */
const CURATED = [
  // Player puns (affectionate).
  'Lionel Messiah',
  'Wayne Rooney Tunes',
  'Vincent Company',
  'Pique Blinders',
  'Xhaka Khan',
  'Alisson Wonderland',
  'Cesc Appeal',
  'Werner Bros',
  'Sonny Side Up',
  "N'Golo Can't",
  'Dele Alli-Oop',
  'Buffon Appetit',
  'Benzema Mayo',
  'Andy Cole Slaw',
  'James Milner Time',
  'Grealish & Chips',
  'Diego Costa Lot',
  'Toni Kroos Control',
  'Harry Kane & Abel',
  'Virgil van Dijkstra',
  'Zlatan Brie',
  'Robben Hood',
  'Hazard Lights',
  'Kante Touch This',
  'Salah-Bration',
  'Kevin De Brew',
  'Bale Force Winds',
  'Modric Van Winkle',
  'Suarez Bueno',
  'Son of a Pitch',
  // Generic football / gamer jokes.
  'Sunday League Hero',
  'Nutmeg Merchant',
  'Sweaty Tryhard',
  'The Gaffer',
  'Bench Warmer',
  'Goal Hanger',
  'Clean Sheet King',
  'Panenka Pete',
  'Long Ball Larry',
  'Tekkers Merchant',
  'Golden Boot',
  'Hat-Trick Harry',
  'Keyboard Keeper',
  'Tiki-Taka Terry',
  'Volley Llama',
  'Header Hunter',
  'Offside Again',
  'Bottle Job Bob',
  'Screamer Merchant',
  'Park The Bus',
] as const;

const ADJECTIVES = [
  'Baller',
  'Offside',
  'Nutmeg',
  'Hattrick',
  'Wonder',
  'Screamer',
  'Bicycle',
  'Panenka',
  'Sweaty',
  'Clinical',
  'Cheeky',
  'Rabona',
  'Worldie',
  'Sunday',
  'TikiTaka',
  'Rocket',
  'Tekkers',
  'Sniper',
  'Silky',
  'Prime',
  'Bottled',
  'Wonky',
  'Lethal',
  'Deadly',
  'Chipped',
  'Dinked',
] as const;

const NOUNS = [
  'Knowledger',
  'Merchant',
  'Wizard',
  'Maestro',
  'Goblin',
  'Gaffer',
  'Pundit',
  'Legend',
  'Boffin',
  'Machine',
  'Enjoyer',
  'Menace',
  'Baller',
  'Wonderkid',
  'Keeper',
  'Striker',
  'Hunter',
  'Bandit',
  'Maverick',
  'Poacher',
  'Playmaker',
  'Nutmegger',
  'Finisher',
  'Gremlin',
  'Rascal',
  'Beast',
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** e.g. "Lionel Messiah", "OffsideWizard", "PanenkaPoacher". */
export function randomFootballName(): string {
  // Half curated one-liners, half generated combos — authentic vibe + variety.
  if (Math.random() < 0.5) {
    return pick(CURATED);
  }
  return pick(ADJECTIVES) + pick(NOUNS);
}
