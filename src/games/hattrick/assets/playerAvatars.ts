/**
 * Player illustrations for the "played with X" teammate axis chips.
 *
 * HAND-MAINTAINED (not generated). To enable a teammate avatar:
 *   1. Save a square, transparent PNG (~96px) into ./players/ using the
 *      filename in the comment (e.g. players/messi.png).
 *   2. Uncomment that player's line below.
 *
 * Keys are the footballer's dataset id (must match footballers.ts / the
 * AXIS_TEAMMATES hub list in ../grid.ts). Until a line is uncommented, the chip
 * falls back to the 🤝 icon + the player's (disambiguated) name — see
 * criterionImage()/criterionIcon() in ../criterionIcon.ts.
 *
 * IMPORTANT: a `require('./players/x.png')` for a file that does NOT exist will
 * break the bundler — only uncomment a line once its PNG is in place.
 */
export const PLAYER_AVATARS: Record<string, number> = {
  // ── Megastars ──────────────────────────────────────────────────────────
  'Messi, Lionel': require('./players/messi.png'),
  'Ronaldo, Cristiano': require('./players/cristiano.png'),
  'Neymar': require('./players/neymar.png'),
  'De Bruyne, Kevin': require('./players/debruyne.png'),
  'Lewandowski, Robert': require('./players/lewandowski.png'),

  // ── High-connectivity hubs (recognizable, not mega) ────────────────────
  'Cancelo, João': require('./players/cancelo.png'),
  'Lukaku, Romelu': require('./players/lukaku.png'),
  'Kovačić, Mateo': require('./players/kovacic.png'),
  'Sterling, Raheem': require('./players/sterling.png'),
  'Di María, Ángel': require('./players/dimaria.png'),
  'Félix, João': require('./players/felix.png'),
  'Gündoğan, İlkay': require('./players/gundogan.png'),
  'Aubameyang, Pierre-Emerick': require('./players/aubameyang.png'),
  'Courtois, Thibaut': require('./players/courtois.png'),
  'Sánchez, Alexis': require('./players/alexis.png'),
  'Silva, Thiago': require('./players/thiagosilva.png'),
  'Fàbregas, Cesc': require('./players/fabregas.png'),
  'Pogba, Paul': require('./players/pogba.png'),
  'Hakimi, Achraf': require('./players/hakimi.png'),
  'Rüdiger, Antonio': require('./players/rudiger.png'),
  'Walker, Kyle': require('./players/walker.png'),

  // ── Classic hubs ───────────────────────────────────────────────────────
  'Ibrahimović, Zlatan': require('./players/zlatan.png'),
  'Ramos, Sergio': require('./players/ramos.png'),
  'Suárez, Luis': require('./players/suarez.png'),
  'Modrić, Luka': require('./players/modric.png'),
  'Benzema, Karim': require('./players/benzema.png'),
  'Busquets, Sergio': require('./players/busquets.png'),
  'Xavi': require('./players/xavi.png'),
  'Iniesta, Andrés': require('./players/iniesta.png'),
  'Lampard, Frank': require('./players/lampard.png'),
  'Gerrard, Steven': require('./players/gerrard.png'),
  'Kroos, Toni': require('./players/kroos.png'),
  'Müller, Thomas': require('./players/muller.png'),
  'Buffon, Gianluigi': require('./players/buffon.png'),
  'Totti, Francesco': require('./players/totti.png'),
  'Pirlo, Andrea': require('./players/pirlo.png'),
  'Maldini, Paolo': require('./players/maldini.png'),
};
