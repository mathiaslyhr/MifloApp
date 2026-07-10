# Lineup curation rules

The files in this directory feed `FAMOUS_LINEUPS` (aggregated in
`../famousLineups.ts`) and, once fully enriched, the Team sheet daily game.
Source of truth for every entry is the match's Wikipedia final page (the
"Details" lineup box), cross-checked against UEFA/FIFA match reports where
available.

## Per-entry rules

- **Exactly 11 players**, GK first, then formation rows top to bottom. Within
  a row, order right to left (RB first, LB last) like a printed team sheet.
- **`formation`** digits must sum to 10.
- **`shirt`** is the number worn in that match, not the player's best-known
  number.
- **`captain`**: exactly one — whoever wore the armband at kick-off (mind
  suspensions: Man Utd 1999 = Schmeichel, Chelsea 2012 = Lampard).
- **`goals`**: goals scored in this match, including extra time, excluding
  shootout penalties and excluding own goals. A sub's goals are simply not
  recorded (only the starting XI exists here), so per-player goals may sum to
  less than `match.goalsFor`.
- **`match.oppOwnGoals`**: opponent own goals inside `goalsFor` (e.g. France
  2018), so the validation `sum(goals) + oppOwnGoals <= goalsFor` still holds.
- **`assists`**: only where the historical record is solid — roughly 1990s
  onward, or genuinely famous earlier ones (Pelé for Carlos Alberto, 1970).
  When sources disagree, omit the field entirely.
- **Both finalists** of one match may be separate entries (France 2018 and
  Croatia 2018); the schedule builder keeps them off consecutive days.
- **`subbedOff`**: true when the starter was taken off during the match
  (swap-arrows badge). Curated best-effort on well-remembered matches only —
  absence means "unknown or played the whole match", never a fact. A red card
  is NOT `subbedOff` (Gabriel Jesus 2019 has `redCard`, not `subbedOff`).
- **`redCard` / `yellowCard`**: card badges, same best-effort policy as
  `subbedOff` — absence means "no card or unknown", never a fact. A second
  yellow is recorded as `redCard` only (Desailly 1998, Heitinga 2010). Only
  the famous, verified reds are curated so far (Lehmann 2006, Drogba 2008,
  Zidane 2006, Desailly 1998, Heitinga 2010, Gabriel Jesus 2019); yellows
  await a proper match-report pass.
- **Team sheet pool cutoff**: only `year >= 1990` (`TEAMSHEET_MIN_YEAR`)
  enters the daily pool. Older XIs stay curated here for possible future use.

## Answer matching / aliases

The engine automatically accepts the folded full `name` and the folded bare
surname (last name token) when that surname is unique within the XI. `fold`
strips most diacritics (ć, š, é, ö, ã → ascii) but NOT æ/ø/œ/đ or
apostrophes, so:

- Danish/Norwegian names carry an ASCII alias ('Sivebæk' → 'Sivebaek').
- Apostrophe names carry spelled-out aliases ("Eto'o" → 'Etoo').
- Multi-word surnames carry the surname alias ('De Paul', 'Mac Allister').
- Mononym-famous players carry the mononym ('Bernardo', 'Enzo') when it is
  unambiguous within the XI.
- Two players sharing a surname in one XI: neither owns it — both need
  distinguishing aliases (enforced by the token-uniqueness test).

## Fact-check flags

July 2026: formations and within-row player ORDER (sides) were verified
against the Wikipedia Details boxes for every contested post-1990 entry
(~25 entries corrected, incl. two wrong players: Bailly→Smalling in
mu-2017, Jara→Francisco Silva in chile-2015). The flags below are about
shirt numbers / assists / captains and still stand where listed.

Entries whose shirt numbers, assists or captain still need a second pass
against the match report (all curated from memory, July 2026). Highest
priority first:

- `denmark-1992-euro-final` — shirt numbers (esp. Schmeichel 16, Larsen 13,
  Vilfort 15, Piechnik 17) and the 5-3-2 shape.
- `brazil-1994-world-cup-final` — Mazinho 9 vs Zinho 17 (Dunga 8 is right).
- `italy-1994-world-cup-final` — Albertini 11, Berti 16, Donadoni 17.
- `germany-2002-world-cup-final` — Ramelow 4, Jeremies 16, Neuville 10.
- `italy-2000-euro-final` — most numbers (Toldo 12, Iuliano 4, Fiore 18,
  Delvecchio 11) and Pessotto's start.
- `greece-2004-euro-final` — Kapsis 19, Katsouranis 21, Giannakopoulos 10,
  Fyssas 14.
- `manchester-city-2021-ucl-final` — De Bruyne as kickoff captain.
- `manchester-united-2017-europa-final` — Valencia as kickoff captain.
- `atletico-madrid-2016-ucl-final` — Saúl 8, Augusto Fernández 12.
- `atletico-madrid-2018-europa-final` — Vrsaljko 16, Correa 11, Costa 18,
  and the Gabi/Griezmann assist credits.
- `chelsea-2019-europa-final` — Giroud/Hazard assist credits.
- `ajax-1995-ucl-final` — Seedorf 10, Litmanen 14, Davids 8, R. de Boer 9.
- `juventus-1996-ucl-final` — Torricelli 2, Pessotto 3, Paulo Sousa 14.
- `borussia-dortmund-1997-ucl-final` — Feiersinger's start, Heinrich 17,
  Lambert 16, and Möller's three assist credits.
- `real-madrid-1998-ucl-final` — Karembeu 21, Seedorf 16, Panucci 2.
- `real-madrid-2002-ucl-final` — Helguera 21, Solari 11, César Sánchez 23.
- `ac-milan-1994-ucl-final` — Panucci 15, Donadoni 7, Massaro 9, and the
  assist credits.
- `marseille-1993-ucl-final` — most numbers; Eydelie 5.
- `barcelona-1992-european-cup-final` — most numbers (Guardiola 5, Laudrup 9,
  Eusebio 10, Salinas 7).
- `ajax-1972-european-cup-final` — numbers besides Cruyff 14.
- `liverpool-1977-european-cup-final` — Case 8, McDermott 10, Kennedy 5,
  Heighway 9 and the Heighway assist.
- `celtic-1967-european-cup-final` — Wallace 8 vs Chalmers 9, Craig/Murdoch
  assist credits.
- `west-germany-1954-world-cup-final` + `hungary-1954-world-cup-final` —
  numbers (Posipal 7, Liebrich 10, Mai 8, Schäfer 20; Tóth 20).
- `brazil-1958-world-cup-final` / `brazil-1962-world-cup-final` — numbers
  (Bellini 2 vs Orlando 5; Didi 6 in 58 vs 8 in 62; Amarildo 21) and
  Garrincha's two 1958 assist credits.
- `west-germany-1966-world-cup-final` — Held 10, Schulz 5, Weber 6.
- `netherlands-1978-world-cup-final` — Poortvliet 14, Brandts 5, the van de
  Kerkhof twins' 10/11.
- `argentina-1978-world-cup-final` — Gallego 7, Ortiz 16, Galván 6.
- `italy-1982-world-cup-final` — Oriali 13 and the Gentile assist credit.
- `barcelona-2006-ucl-final` / `arsenal-2006-ucl-final` — Giuly 8, Van
  Bronckhorst 16; Fàbregas 15, Hleb 13, and the Henry assist credit.
- `bayern-munich-2012-ucl-final` — Contento 26, Tymoshchuk 44.
- Assist fields in general err toward omission; where present they follow
  the commonly cited record (UEFA/FIFA reports, Wikipedia).
- ALL `subbedOff` flags (July 2026) — curated from memory across ~40
  lineups; verify against the match reports in the same pass.
- ALL `kit` colours (July 2026) — the shirt each team wore THAT DAY, from
  memory; stripes/checks approximated by dominant colour. Verify especially
  the away-kit picks: spain-2010 (navy), argentina-2014 (dark blue),
  juventus-1996 (blue), arsenal-2006 (yellow), greece-2004 (blue), the
  Milan white-finals kits (1994/2005/2007), ajax-1995 (white home),
  barcelona-1992 (orange), plus bayern-2012, chelsea-2012, mu-2017,
  brazil-2019 and both Barcelona 2009/2011 home assumptions. No `gkBody`
  is curated yet — keepers render neutral dark until that pass.
