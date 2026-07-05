# Footballer roadmap

How we keep growing `src/data/football/footballers.ts`. **There is no hard cap on
player count** — the dataset, tooling and tests all scale linearly, so 500+ is
fully supported (see [Scaling past 500](#scaling-past-500)). ~300–350 is the
sweet spot for grid *fairness*; beyond that is about breadth + teammate density.

Current: **270 players, 73 clubs.**

## The add-a-batch recipe (repeatable)

1. **New clubs first** → add to `src/data/football/clubs.ts` (`{id, name, country, league}`).
   For each new club also add:
   - its footylogos slug to `CLUB_SLUG` in `scripts/build-logo-assets.mjs`
   - a short label to `CLUB_SHORT` in `src/games/tic-tac-toe/grid.ts` (≤7 chars)
   - if the club/nation introduces a **new country**: its flagcdn code to
     `COUNTRY_ISO` in `scripts/build-flag-assets.mjs` **and** a 3-letter code to
     `NATION_SHORT` in `grid.ts`. New `league` strings go in the `KNOWN_LEAGUES`
     allowlist in `__tests__/integrity.test.ts`.
2. **Author players** → append entries to the **end** of `footballers.ts`
   (order doesn't matter; the sorter fixes it). Follow the existing shape: id is
   `"Surname, First"` or a mononym; accurate `clubId`s, `nationality`,
   `positions`; key `honours` (mandatory `years` for `ballon-dor`); `tags` =
   `legends` (retired) or `current-stars` (active). Keep facts accurate — tests
   only check structure, not truth.
3. **Sort + dedupe** → `node scripts/sort-footballers.mjs` (alphabetises by id and
   fails on duplicate ids).
4. **Regenerate** → `npm run assets:flags && npm run assets:logos && npm run data:build`.
5. **Verify green** → `npx tsc --noEmit && npm test`.
6. **Ship** → `npm run ios` (device) / `npm run ios:sim` (simulator).

## Invariants that must stay green

Unique ids · never rename existing ids · every `clubId` resolves · `to ≥ from` ·
`seasonStat` tallies 0–60 and reference a club the player had · `ballon-dor`
`years.length === count` · category pool depths · **every nationality has a
flag** · **every used club has a crest** · club league in the allowlist.

## Scaling past 500

Confirmed: **no max-count assertion exists anywhere**. What scales:
- `sort-footballers.mjs`, asset codegen, `data:build`, the search picker and grid
  generation are all linear in player count — fine to 500–1000+.
- Cost is only (a) bundle size — each crest ~5–12 KB, each flag ~3 KB, already
  tiny — and (b) factual-curation effort.

Optional once the pool is large, for richer grids (not required):
- raise the per-category minimums in `integrity.test.ts`;
- track a per-club depth target (below) so no axis club is thin.

## Priority queue (depth-first)

Prioritise **depth on clubs that appear as grid axes** and **era spread** (so the
future teammate engine has dense links), over chasing obscure names.

### Per-club depth target
Aim for **≥10 players spanning multiple eras** on each marquee axis club:
Man City · Man Utd · Liverpool · Arsenal · Chelsea · Spurs · Real Madrid ·
Barcelona · Atlético · Juventus · Milan · Inter · Napoli · Bayern · Dortmund ·
PSG · Marseille. Audit with a quick count per `clubId` before each batch.

### Batches (≈40 each → ~500+)
- **B7 — PL era depth:** Man Utd (Van der Sar, Evra, Carrick, Valencia, Rashford done),
  Liverpool (Henderson, Robertson done, Alisson done, Coutinho done, Mascherano,
  Torres done), City (Zabaleta done, Nasri done, Sterling done, Silva, Zinchenko),
  Chelsea/Arsenal/Spurs squad-mates + cult (Di Canio, Crespo, Berbatov done).
- **B8 — La Liga / Portugal depth:** Real & Barça era squads (Carvajal, Militão,
  Rakitić done, Alba done, Alves done), Atlético (Griezmann-era, Koke, Godín,
  Oblak), Sevilla/Villarreal/Betis, Benfica/Porto/Sporting cores.
- **B9 — Serie A depth:** Milan/Inter/Juve/Roma/Napoli/Lazio era squads
  (Pirlo-era, Totti-era, Scudetto winners), cult (Di Natale, Cassano done, Balotelli done).
- **B10 — Bundesliga / Ligue 1 depth:** Bayern & Dortmund squads (Hummels done,
  Reus done, Sancho, Bellingham done, Goretzka done), Leverkusen 2024, PSG galácticos,
  Lyon/Monaco/Marseille eras.
- **B11 — Nations & tournaments:** fill World Cup / Euro / Copa squads and
  under-represented nations (Africa, Asia, Americas) so nationality axes deepen.
- **B12 — Cult & throwbacks:** fan-favourite names and one-club legends to taste
  (Di Natale, Del Piero-era, Okocha done, Adriano done, Riquelme done, …).

Each batch: add clubs → author → sort → regen assets → tests green. Repeat until
the pool is as deep as you want — 500 is a milestone, not a ceiling.
