# Miflo Sitemap

The whole app at a glance: how you move through it, and the exact order of play for
all eight games.

---

## 01 · Getting in (first launch)

The app checks for a saved profile before anything else.

- **No profile** → Welcome → **Quick setup** (Name → Code → Favorites) → **Home**
- **Already have a profile** → Welcome → **Enter code** (move from old phone) → **Home**
- **Profile exists** → straight to **Home**

The Welcome flow runs outside the navigator; once a profile is ready it hands off to
the tab shell on the Home dashboard.

---

## 02 · The shell — four tabs

A floating, icon-only "island" bar sits over every page. All four tabs stay mounted as
you switch between them.

### Home — Today dashboard
- **Today** — the four daily puzzles as tappable status rows
- **Play with friends** — create party / join party by code
- **Friends today** — carousel of friends' daily results
- Streak flame · App Store QR

### Games — full catalog
- Tiles for every game with **audience** and **Daily** pills
- Solo tile → opens the puzzle directly
- Multiplayer tile → makes a room → **Lobby**
- Phone icon on a tile → pass-and-play (one device)

### Friends — social (badges when requests are pending)
- Toggle **Friends** / **Worldwide** leaderboard
- Incoming **requests** to accept or decline
- Friend cards: today's scores, streak, presence; swipe to remove
- Search adds a friend by name or code

### Profile — you (hamburger → Menu)
- Avatar (tap to set), name, friend count
- Friend code · favorite player / club / nation
- **Streaks** per daily · full **daily log** with answers (owner-only)
- Menu → Settings, How to play, About, transfer, delete profile

---

## 03 · Beyond the tabs (pushed-over screens)

Screens that open on top of the tab shell with their own back button.

**Party — playing together**
- **Join** — type a 4-character party code
- **Lobby** — share code, live roster, host controls
- **Game picker** — host chooses the game (free party only)
- Game screens: Hattrick · Red Card · Offside · Cult Hero

**Menu — settings & info**
- **Settings** — language, haptics, reminders
- **How to play** · **About**
- **One device** — pass-and-play explainer
- **Move to a new phone** · delete profile

**People — friends & records**
- **Friends list** — from the profile header count
- **Friend profile** — streaks, log, invite to party, unfriend
- **Head to head** — 1v1 record across the party games

**Solo — daily puzzles**
- Scout · Top Bins · Journeyman · Team Sheet
- Reached straight from a Games tile or a Home Today row

---

## 04 · Online multiplayer — party games, step by step

Each starts in the **Lobby**: friends join by code, the host sets rounds and taps start,
everyone follows into the game. The **bold** step is the one that defines the game. Every
game also has a one-phone pass-and-play version (see the note at the end of this section).

### Hattrick — grid, turn based (2+ players)
Football tic-tac-toe on a criteria grid.

1. Host starts — a fresh 3×3 grid of row & column criteria appears.
2. **Take turns claiming a cell** — on your turn, pick an empty cell and name a footballer
   who matches both its row and its column.
3. Wrong or too slow — a bad guess or a run-out timer just passes the turn on, no cell claimed.
4. Win the line — three of your cells in a row wins; a full board with no line is a tie.
5. Stuck? Agree to tie — any player can propose a tie; once all accept, the board reveals
   grayed "what could have been" answers.

*Ends:* three-in-a-row winner or agreed tie → rematch deals a new grid.

### Red Card — imposter, hidden role (3+ players)
One player is the imposter who doesn't know the secret footballer.

1. Roles dealt privately — each phone shows only its own role: the imposter (no footballer)
   or a detective who sees the secret footballer.
2. Everyone answers the question — a shared question each round; every player types an
   answer. Answers stay hidden until all are in.
3. **Host reveals answers one at a time** — the host taps through the shuffled answers so
   the table reads them together and hunts for the odd one.
4. Secret vote — after the last round everyone votes for who they think is the imposter.
5. Caught? One redemption guess — a caught imposter gets a single blind guess at the secret
   footballer for bonus points.
6. Reveal & scores — identity, votes and point deltas shown; running scoreboard carries
   between hands.

*Scoring:* detectives score for catching, the imposter scores for escaping or redeeming.

### Offside — odd one out, timed race (2+ players)
Spot the outlier faster than everyone else.

1. Host sets rounds & starts — a deck of four-card rounds is built and shared.
2. **Four cards, everyone taps at once** — all four cards show on every phone against one
   clock; tap the odd one out. Faster correct answers score more.
3. Reveal the outlier — the correct card and why it's the odd one is shown, with each
   player's point change.
4. Scoreboard beat — running leaderboard; host advances to the next round.
5. Final leaderboard — after the last round, final standings and the winner.

*Note:* a simultaneous race, not host-paced reveals; the host only advances between rounds.

### Cult Hero — rarest answer, Pointless-style (2+ players)
Name a real player that fits, but the rarer your pick the better.

1. Host sets rounds & starts — a prompt each round, e.g. "a player who played for Real Madrid".
2. Everyone secretly picks a player — all players lock in a real footballer that fits the
   prompt at the same time.
3. **Host reveals results one at a time** — common answers first, building up to the
   rarest, which scores highest, judged against every Cult Hero game ever played.
4. Leaderboard beat — standings between prompts; host advances to the next round.
5. Final standings — after the last round, the winner is the one with the most obscure picks.

*Scoring:* obscurity percentile — an invalid pick scores zero.

> **One phone (pass-and-play):** same steps offline, but a "pass the phone to …" screen
> replaces the private/secret parts, and any tap advances the shared beats — there is no
> host role.

---

## 05 · Solo dailies — one puzzle a day

Open straight from a Games tile or a Home Today row. Guesses are unlimited, and there are
deliberately **no share buttons**. Your streak survives only inside each game's guess or
miss limit.

### Scout — mystery player, Wordle-style
Guess today's secret footballer from clue colours.

1. Guess a footballer — search and pick any player.
2. **Read the five columns** — nationality, position, club, league, age light up green for
   a hit, plus an up / down arrow on age.
3. Narrow it down — unlimited tries, no give-up.
4. Solve to win — answer revealed with stats. Streak kept only if solved in ≤ 10 guesses.

### Top Bins — top-10 list
Fill in every name on today's ranked top ten.

1. Read the list title — a ranked top-10 with ten blank slots.
2. **Guess to fill slots** — a correct name drops into its rank; wrong guesses add to the
   miss count.
3. Complete all ten — all slots filled wins.
4. Or give up — reveals the rest faded. Streak kept if finished within 10 misses.

### Journeyman — career path
Name the player behind a hidden career.

1. Study the career path — every club spell shown oldest first; the player is hidden.
2. **Guess the player** — each wrong guess unlocks one hint in order: nationality, then
   position, then age.
3. Solve or give up — win reveals the player; "Give up" ends it. Streak kept within 10 guesses.

### Team Sheet — name the XI
Name all eleven starters from a real match.

1. See the formation — eleven numbered tokens on a pitch under the match and score line.
2. **Name players into slots** — guess freely, or tap a token to target that exact
   position. Hits show clue badges: goals, assist, captain, cards.
3. Fill all eleven — complete the XI to win.
4. Or give up — reveals the rest faded. Streak kept within just 5 misses.

---

## 06 · Reading a daily — the log states

The same status row appears on Home, on your Profile log, and on friends' cards, so every
surface reads identically. Answers are yours only — a friend's copy never carries them.

| State | Glyph | Meaning |
| --- | --- | --- |
| **Not started** | dimmed circle | no result yet |
| **Ongoing** | eye + counts | in progress, with right / wrong counts |
| **Solved** | green check | finished correctly |
| **Surrendered** | red flag | gave up, or rolled over unfinished |
