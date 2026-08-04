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

## Batch 3 — sent 2026-08-04 — status: ADDED (approved + published 2026-08-04)

| #  | Player                | Dataset id               | File (`--names`) | Status |
|----|-----------------------|--------------------------|------------------|--------|
| 1  | Franz Beckenbauer     | `Beckenbauer, Franz`     | `beckenbauer`    | added  |
| 2  | Michel Platini        | `Platini, Michel`        | `platini`        | added  |
| 3  | Marco van Basten      | `van Basten, Marco`      | `vanbasten`      | added  |
| 4  | Romário               | `Romário`                | `romario`        | added  |
| 5  | Roberto Baggio        | `Baggio, Roberto`        | `baggio`         | added  |
| 6  | Alessandro Del Piero  | `Del Piero, Alessandro`  | `delpiero`       | added  |
| 7  | Andriy Shevchenko     | `Shevchenko, Andriy`     | `shevchenko`     | added  |
| 8  | Samuel Eto'o          | `Eto'o, Samuel`          | `etoo`           | added  |
| 9  | Dennis Bergkamp       | `Bergkamp, Dennis`       | `bergkamp`       | added  |
| 10 | Bukayo Saka           | `Saka, Bukayo`           | `saka`           | added  |
| 11 | Rodri                 | `Rodri`                  | `rodri`          | added  |
| 12 | Jamal Musiala         | `Musiala, Jamal`         | `musiala`        | added  |
| 13 | Franck Ribéry         | `Ribéry, Franck`         | `ribery`         | added  |
| 14 | Paul Scholes          | `Scholes, Paul`          | `scholes`        | added  |
| 15 | Carles Puyol          | `Puyol, Carles`          | `puyol`          | added  |
| 16 | Wesley Sneijder       | `Sneijder, Wesley`       | `sneijder`       | added  |

Cut command once the sheet is in `tools/art/sheets/`:

```
node slice-sheet.mjs grid16 sheets/<file>.png \
  --names=beckenbauer,platini,vanbasten,romario,baggio,delpiero,shevchenko,etoo,bergkamp,saka,rodri,musiala,ribery,scholes,puyol,sneijder
```

## Batch 5 — sent 2026-08-04 — status: sent

| #  | Player                 | Dataset id                 | File (`--names`)  | Status |
|----|------------------------|----------------------------|-------------------|--------|
| 1  | Eusébio                | `Eusébio`                  | `eusebio`         | sent   |
| 2  | George Best            | `Best, George`             | `best`            | sent   |
| 3  | Bobby Charlton         | `Charlton, Bobby`          | `charlton`        | sent   |
| 4  | Gerd Müller            | `Müller, Gerd`             | `gerdmuller`      | sent   |
| 5  | Ruud Gullit            | `Gullit, Ruud`             | `gullit`          | sent   |
| 6  | Gabriel Batistuta      | `Batistuta, Gabriel`       | `batistuta`       | sent   |
| 7  | Fabio Cannavaro        | `Cannavaro, Fabio`         | `cannavaro`       | sent   |
| 8  | Fernando Torres        | `Torres, Fernando`         | `torres`          | sent   |
| 9  | Michael Owen           | `Owen, Michael`            | `owen`            | sent   |
| 10 | David Villa            | `Villa, David`             | `villa`           | sent   |
| 11 | Xabi Alonso            | `Alonso, Xabi`             | `xabialonso`      | sent   |
| 12 | Bastian Schweinsteiger | `Schweinsteiger, Bastian`  | `schweinsteiger`  | sent   |
| 13 | Mesut Özil             | `Özil, Mesut`              | `ozil`            | sent   |
| 14 | Nemanja Vidić          | `Vidić, Nemanja`           | `vidic`           | sent   |
| 15 | Carlos Tevez           | `Tevez, Carlos`            | `tevez`           | sent   |
| 16 | Radamel Falcao         | `Falcao, Radamel`          | `falcao`          | sent   |

Cut command once the sheet is in `tools/art/sheets/`:

```
node slice-sheet.mjs grid16 sheets/<file>.png \
  --names=eusebio,best,charlton,gerdmuller,gullit,batistuta,cannavaro,torres,owen,villa,xabialonso,schweinsteiger,ozil,vidic,tevez,falcao
```

Note: renumbered 2026-08-04 to match the user's count — the Van Persie
batch is 4, the Eusébio batch is 5 (its prompt was skipped and re-sent).
ALWAYS identify a sheet by the printed player names, never the filename. Sheets are
never deleted (folder = permanent archive). Sheets for batches 1-3 were
deleted before this rule; the user can re-download them from ChatGPT history
(batch 1's is still wanted for the yamal/vandijk re-cut). Zico wanted but not
in the dataset — swapped for Bobby Charlton.

## Batch 4 — sent 2026-08-04 — status: ADDED (approved + published 2026-08-04)

| #  | Player                  | Dataset id                  | File (`--names`)  | Status |
|----|-------------------------|-----------------------------|-------------------|--------|
| 1  | Robin van Persie        | `van Persie, Robin`         | `vanpersie`       | added  |
| 2  | Patrick Vieira          | `Vieira, Patrick`           | `vieira`          | added  |
| 3  | Roy Keane               | `Keane, Roy`                | `roykeane`        | added  |
| 4  | Gary Lineker            | `Lineker, Gary`             | `lineker`         | added  |
| 5  | Alan Shearer            | `Shearer, Alan`             | `shearer`         | added  |
| 6  | N'Golo Kanté            | `Kanté, N'Golo`             | `kante`           | added  |
| 7  | John Terry              | `Terry, John`               | `terry`           | added  |
| 8  | Rio Ferdinand           | `Ferdinand, Rio`            | `ferdinand`       | added  |
| 9  | Paulo Dybala            | `Dybala, Paulo`             | `dybala`          | added  |
| 10 | Lautaro Martínez        | `Martínez, Lautaro`         | `lautaro`         | added  |
| 11 | Phil Foden              | `Foden, Phil`               | `foden`           | added  |
| 12 | Florian Wirtz           | `Wirtz, Florian`            | `wirtz`           | added  |
| 13 | Khvicha Kvaratskhelia   | `Kvaratskhelia, Khvicha`    | `kvaratskhelia`   | added  |
| 14 | Victor Osimhen          | `Osimhen, Victor`           | `osimhen`         | added  |
| 15 | Marcelo                 | `Marcelo`                   | `marcelo`         | added  |
| 16 | Philippe Coutinho       | `Coutinho, Philippe`        | `coutinho`        | added  |

Batch 4 notes: crests cut with --y1 (vanpersie:235, dybala:768, lautaro:765).
Keane/Coutinho chest marks verified as collar detail, kept full.

Cut command once the sheet is in `tools/art/sheets/`:

```
node slice-sheet.mjs grid16 sheets/<file>.png \
  --names=vanpersie,vieira,roykeane,lineker,shearer,kante,terry,ferdinand,dybala,lautaro,foden,wirtz,kvaratskhelia,osimhen,marcelo,coutinho
```
