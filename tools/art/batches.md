# Portrait batch checklist

Review page (update THIS artifact URL each batch, then `open` it for the
user's approval before publishing — never mint a new artifact):
https://claude.ai/code/artifact/f4e7d854-e8ac-43b5-9028-611ebbac55b2

The durable record of every portrait batch: who was requested, in what grid
order, and what happened to each cut. The agent writes a batch here when the
prompt is SENT to the user, and updates every player's status after cutting —
so any session can pick up where another left off. See
`docs/portrait-batches.md` for the full workflow.

Statuses: **sent** (prompt delivered, awaiting sheet) · **added** (cut, staged
in `scripts/staging/portraits.json`, published) · **failed** (bad cell —
clipped/wrong face; goes into a later batch's regeneration slot).

After cutting a sheet, report to the user per player: added or not, with the
reason for any failure.

## Batch 1 — sent 2026-08-02 — status: ADDED (published 2026-08-02)

Reading order left→right, top→bottom = `--names` order for `grid16`.

| #  | Player            | Dataset id          | File (`--names`) | Status |
|----|-------------------|---------------------|------------------|--------|
| 1  | Pelé              | `Pelé`              | `pele`           | added  |
| 2  | Diego Maradona    | `Maradona, Diego`   | `maradona`       | added  |
| 3  | Kylian Mbappé     | `Mbappé, Kylian`    | `mbappe`         | added  |
| 4  | Erling Haaland    | `Haaland, Erling`   | `haaland`        | added  |
| 5  | Zinédine Zidane   | `Zidane, Zinédine`  | `zidane`         | added  |
| 6  | Ronaldo Nazário   | `Ronaldo`           | `ronaldo-r9`     | added  |
| 7  | Ronaldinho        | `Ronaldinho`        | `ronaldinho`     | added  |
| 8  | David Beckham     | `Beckham, David`    | `beckham`        | added  |
| 9  | Thierry Henry     | `Henry, Thierry`    | `henry`          | added  |
| 10 | Wayne Rooney      | `Rooney, Wayne`     | `rooney`         | added  |
| 11 | Mohamed Salah     | `Salah, Mohamed`    | `salah`          | added  |
| 12 | Harry Kane        | `Kane, Harry`       | `kane`           | added  |
| 13 | Jude Bellingham   | `Bellingham, Jude`  | `bellingham`     | added  |
| 14 | Vinícius Júnior   | `Vinícius Júnior`   | `vinicius`       | added  |
| 15 | Lamine Yamal      | `Yamal, Lamine`     | `yamal`          | re-cut |
| 16 | Virgil van Dijk   | `van Dijk, Virgil`  | `vandijk`        | re-cut |

Cut command once the sheet is in `tools/art/sheets/`:

```
node slice-sheet.mjs grid16 sheets/<file>.png \
  --names=pele,maradona,mbappe,haaland,zidane,ronaldo-r9,ronaldinho,beckham,henry,rooney,salah,kane,bellingham,vinicius,yamal,vandijk
```

Batch 1 notes: sheet had crests on 11 shirts despite the prompt — cut off
with `--y1` hard bottoms right above each badge (pele:244, mbappe:245,
haaland:250, zidane:497, ronaldo-r9:502, beckham:497, henry:747, rooney:731,
salah:745, yamal:974, vandijk:972). Clean: maradona, ronaldinho, kane,
bellingham, vinicius.

User review 2026-08-04: yamal + vandijk bottoms cut too tight (crest margin
too generous) — re-cut pending; user re-downloads the sheet from ChatGPT
history (original was deleted post-publish, before the approval gate existed).

## Batch 2 — sent 2026-08-02 — status: ADDED (approved + published 2026-08-04)

| #  | Player           | Dataset id            | File (`--names`) | Status |
|----|------------------|-----------------------|------------------|--------|
| 1  | Johan Cruyff     | `Cruyff, Johan`       | `cruyff`         | added  |
| 2  | Kaká             | `Kaká`                | `kaka`           | added  |
| 3  | Didier Drogba    | `Drogba, Didier`      | `drogba`         | added  |
| 4  | Arjen Robben     | `Robben, Arjen`       | `robben`         | added  |
| 5  | Iker Casillas    | `Casillas, Iker`      | `casillas`       | added  |
| 6  | Manuel Neuer     | `Neuer, Manuel`       | `neuer`          | added  |
| 7  | Eden Hazard      | `Hazard, Eden`        | `hazard`         | added  |
| 8  | Gareth Bale      | `Bale, Gareth`        | `bale`           | added  |
| 9  | Son Heung-min    | `Son, Heung-min`      | `son`            | added  |
| 10 | Antoine Griezmann| `Griezmann, Antoine`  | `griezmann`      | added  |
| 11 | Sergio Agüero    | `Agüero, Sergio`      | `aguero`         | added  |
| 12 | Gerard Piqué     | `Piqué, Gerard`       | `pique`          | added  |
| 13 | Roberto Carlos   | `Roberto Carlos`      | `robertocarlos`  | added  |
| 14 | Rivaldo          | `Rivaldo`             | `rivaldo`        | added  |
| 15 | Luís Figo        | `Figo, Luís`          | `figo`           | added  |
| 16 | Eric Cantona     | `Cantona, Eric`       | `cantona`        | added  |

Cut command once the sheet is in `tools/art/sheets/`:

```
node slice-sheet.mjs grid16 sheets/<file>.png \
  --names=cruyff,kaka,drogba,robben,casillas,neuer,hazard,bale,son,griezmann,aguero,pique,robertocarlos,rivaldo,figo,cantona
```

Batch 2 notes: crests cut with --y1 (cruyff:215, casillas:497,
robertocarlos:961, rivaldo:974) — tight margins per user feedback on batch 1.
Griezmann/Piqué/Figo/Cantona chest marks verified as collar detail, kept full.

## Batch 3 — sent 2026-08-04 — status: sent

| #  | Player                | Dataset id               | File (`--names`) | Status |
|----|-----------------------|--------------------------|------------------|--------|
| 1  | Franz Beckenbauer     | `Beckenbauer, Franz`     | `beckenbauer`    | sent   |
| 2  | Michel Platini        | `Platini, Michel`        | `platini`        | sent   |
| 3  | Marco van Basten      | `van Basten, Marco`      | `vanbasten`      | sent   |
| 4  | Romário               | `Romário`                | `romario`        | sent   |
| 5  | Roberto Baggio        | `Baggio, Roberto`        | `baggio`         | sent   |
| 6  | Alessandro Del Piero  | `Del Piero, Alessandro`  | `delpiero`       | sent   |
| 7  | Andriy Shevchenko     | `Shevchenko, Andriy`     | `shevchenko`     | sent   |
| 8  | Samuel Eto'o          | `Eto'o, Samuel`          | `etoo`           | sent   |
| 9  | Dennis Bergkamp       | `Bergkamp, Dennis`       | `bergkamp`       | sent   |
| 10 | Bukayo Saka           | `Saka, Bukayo`           | `saka`           | sent   |
| 11 | Rodri                 | `Rodri`                  | `rodri`          | sent   |
| 12 | Jamal Musiala         | `Musiala, Jamal`         | `musiala`        | sent   |
| 13 | Franck Ribéry         | `Ribéry, Franck`         | `ribery`         | sent   |
| 14 | Paul Scholes          | `Scholes, Paul`          | `scholes`        | sent   |
| 15 | Carles Puyol          | `Puyol, Carles`          | `puyol`          | sent   |
| 16 | Wesley Sneijder       | `Sneijder, Wesley`       | `sneijder`       | sent   |

Cut command once the sheet is in `tools/art/sheets/`:

```
node slice-sheet.mjs grid16 sheets/<file>.png \
  --names=beckenbauer,platini,vanbasten,romario,baggio,delpiero,shevchenko,etoo,bergkamp,saka,rodri,musiala,ribery,scholes,puyol,sneijder
```
