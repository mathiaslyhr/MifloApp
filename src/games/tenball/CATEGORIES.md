# Top Bins category bank

The backlog for `lists.ts`. Lists ship OTA (`npm run data:publish`), so this
bank can be worked through gradually — no app release needed.

## Format rules (why some categories can't ship as-is)

- **Exactly 10 entries, every answer exactly once.** A typed name lands in its
  one slot. Repeat winners are deduped: "Last 10 …" lists mean the last 10
  DIFFERENT winners (and the title must say "different"). A category with
  fewer than 10 possible unique answers cannot be a list (La Liga has 9
  champion clubs ever, the World Cup 8 winning nations).
- **Ties get a curator order** (recency first, then fame). Misses never reveal
  closeness, so tie order can't hurt a player.
- **Aliases**: folded (lowercase, accents stripped — note æ/ø survive folding,
  å does not), bare surname unless ambiguous in-list, Danish spellings for
  country/club names (tyskland, frankrig, københavn…).
- **Values are display strings**; `+` marks a still-counting stat for an
  active player. Prefer closed/historical lists.
- **The type-ahead needs a crowd to hide the answers in.** Suggestions for a
  list come from its `kind`'s pool (`suggestions.ts`): `player` → the whole
  footballer DB, `club` → CLUBS (174), `manager` → MANAGERS (113), `nation` →
  footballer nationalities (87), `other` → the shared `CITIES` dataset (~190).
  A list is only fair when that pool is much larger than its 10 answers — else
  the player just taps the only suggestions and wins blind (this is exactly
  what happened to `last-10-cl-final-cities` before `CITIES` existed). So:
  - `player`/`club`/`manager`/`nation` lists are always safe — the datasets are
    big. Ship them OTA.
  - An `other` list is only safe if its answers are **cities** (CITIES hides
    them). A place list of a *different* type — **stadiums/venues by name**,
    trophies, etc. — has no crowd and needs its own decoy dataset in
    `data/geography` (or nearby) first. That is bundled code = an app build,
    not OTA. A venue list keyed on the host *city* (like the CL-final list) is
    fine as `other`.
  - A brand-new `kind` has no pool at all (it falls back to cities — trivial
    *and* wrong). Always ship the decoy dataset + binary before the list.
- **Data honesty**: numbers only go in `lists.ts` once they are checked
  against a source (Transfermarkt / official league site / Wikipedia record
  pages). Categories below marked NEEDS DATA are good ideas waiting for a
  sourced top 10 — do not fill them from memory.

## Live (in lists.ts)

Career/all-time: most-ballon-dor, wc-top-scorers, wc-most-matches,
pl-top-scorers, pl-most-appearances, pl-most-assists, ucl-top-scorers,
record-transfers, intl-goals-men, serie-a-top-scorers, dk-most-caps,
dk-top-scorers, pl-goals-season, wc-goals-tournament.

Club records: man-united-top-scorers, liverpool-top-scorers,
real-madrid-top-scorers, arsenal-top-scorers, man-united-appearances,
liverpool-appearances.

Titles: cl-titles-clubs, english-titles-clubs, serie-a-titles-clubs,
german-titles-clubs, fa-cups-clubs, euro-titles-nations.

Last 10 different: last-10-ballon-dor, last-10-wc-golden-ball,
last-10-wc-golden-boot, last-10-cl-winners, last-10-cl-managers,
last-10-europa-winners, last-10-fa-cup-winners, last-10-english-champions,
last-10-pl-managers, last-10-serie-a-champions, last-10-pl-golden-boot,
last-10-pfa-poty, last-10-cl-final-cities, last-10-superliga-champions,
last-10-african-poty.

### Season-boundary maintenance (owner: curator, each June/July)

"Last 10" lists and title counts move every season. As of July 2026 the
2025/26 winners still need slotting in (see the session notes / ask the
maintainer), and the 2026 World Cup ends mid-July — wc-top-scorers,
wc-most-matches, wc-goals-tournament, last-10-wc-golden-ball/boot need an OTA
refresh right after the final.

## NEEDS DATA (fits the format; fill from a source, then ship OTA)

Transfers & money: per-club record signings (Real, Barca, United, City,
Chelsea, Liverpool, PSG, Arsenal, Bayern, Juve, Newcastle, Spurs, Atlético,
Napoli, Roma, Benfica, Ajax, Leipzig, Villa, West Ham, Everton, Brighton,
Inter, Milan, Saudi Pro League, MLS); record sales (Barca, Benfica, Ajax,
Monaco); most expensive defenders / goalkeepers / midfielders / teenagers /
British / Brazilian / African / Scandinavian / DANISH players; biggest
transfer profits; highest wages; highest career earnings.

Career numbers: most career goals ever; most CL assists; most CL appearances;
most intl caps (men); most La Liga assists; single-season PL assists; most
hat-tricks; free-kick goals; penalties scored; GK/defender career goals;
La Liga / Bundesliga / Ligue 1 / Eredivisie all-time top scorers; goals in a
calendar year; club top scorers & appearances for Barca, Bayern, Real
(appearances), Chelsea, Spurs, Juve, Milan, Inter, Ajax, BVB, Leicester,
national teams; most PL seasons; oldest/youngest scorers & players; fastest
PL/WC goals; most PL red cards; most own goals; most clubs in a career;
sprint speeds; tallest players; Instagram followers.

Honours (tie-heavy, pick a tiebreak): most CL titles (player), most PL titles
(player), most league titles career, most WC wins (player), PL golden boots,
European golden shoes, PL POTS awards, FIFA The Best, most trophies career.

Managers: most CL/PL/league titles, most games one club, longest-serving.

Clubs/national teams: most WC appearances (tournaments), Copa América titles
(only 8 winners — needs "most", not "different"), AFCON titles, biggest
stadiums, richest clubs, longest unbeaten runs, biggest CL/WC wins,
consecutive titles, domestic doubles.

Danish/Nordic: Superliga all-time top scorers, most successful Danish clubs,
Nordic players with most PL goals, Danes with most CL appearances, most
expensive Danish/Scandinavian players.

Relational (needs Opta/Transfermarkt-grade data): appearances alongside a
teammate, appearances under a manager, combined appearances for two clubs,
WC teammate links, caps for a nation since a year, derby top scorers,
El Clásico top scorers, last 10 club captains, most goals under a manager.

More "Last 10 different": Europa winning managers? (check ≥10 distinct),
WC Golden Boot pre-1986 extension, Bundesliga champions (distinct: Bayern,
Leverkusen, BVB, Wolfsburg, Stuttgart, Werder, Kaiserslautern, HSV, Gladbach,
Köln — verify years), Ligue 1 distinct, Eredivisie distinct, La Liga distinct
only reaches 9 — combine with pre-war? no. Copa/AFCON "last 10 different"
(verify ≥10), Danish managers (last 10 — verify pre-Piontek names),
England managers (caretaker policy needed), CL final venues extension.

## DOESN'T FIT the exactly-10-ranked-unique format (needs a new mode)

- "Clubs X played for" — usually fewer than 10 clubs (CR7 has 5). Would need
  variable-length boards.
- "Players who played for both X and Y" — unranked membership with more than
  10 valid answers; a correct answer has no single slot.
- "Last 10 PL champions" style with repeats — replaced by "different" lists.
- "Players who scored on debut for [club]" — unranked membership.
- Shared awards (1994 WC golden boot) ship as ONE combined entry
  ("Hristo Stoichkov & Oleg Salenko") — acceptable, but never let a person
  appear in two entries of the same list.
