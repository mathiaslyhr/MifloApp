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
| 15 | Lamine Yamal      | `Yamal, Lamine`     | `yamal`          | added  |
| 16 | Virgil van Dijk   | `van Dijk, Virgil`  | `vandijk`        | added  |

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

## Batch 2 — sent 2026-08-02 — status: sent

| #  | Player           | Dataset id            | File (`--names`) | Status |
|----|------------------|-----------------------|------------------|--------|
| 1  | Johan Cruyff     | `Cruyff, Johan`       | `cruyff`         | sent   |
| 2  | Kaká             | `Kaká`                | `kaka`           | sent   |
| 3  | Didier Drogba    | `Drogba, Didier`      | `drogba`         | sent   |
| 4  | Arjen Robben     | `Robben, Arjen`       | `robben`         | sent   |
| 5  | Iker Casillas    | `Casillas, Iker`      | `casillas`       | sent   |
| 6  | Manuel Neuer     | `Neuer, Manuel`       | `neuer`          | sent   |
| 7  | Eden Hazard      | `Hazard, Eden`        | `hazard`         | sent   |
| 8  | Gareth Bale      | `Bale, Gareth`        | `bale`           | sent   |
| 9  | Son Heung-min    | `Son, Heung-min`      | `son`            | sent   |
| 10 | Antoine Griezmann| `Griezmann, Antoine`  | `griezmann`      | sent   |
| 11 | Sergio Agüero    | `Agüero, Sergio`      | `aguero`         | sent   |
| 12 | Gerard Piqué     | `Piqué, Gerard`       | `pique`          | sent   |
| 13 | Roberto Carlos   | `Roberto Carlos`      | `robertocarlos`  | sent   |
| 14 | Rivaldo          | `Rivaldo`             | `rivaldo`        | sent   |
| 15 | Luís Figo        | `Figo, Luís`          | `figo`           | sent   |
| 16 | Eric Cantona     | `Cantona, Eric`       | `cantona`        | sent   |

Cut command once the sheet is in `tools/art/sheets/`:

```
node slice-sheet.mjs grid16 sheets/<file>.png \
  --names=cruyff,kaka,drogba,robben,casillas,neuer,hazard,bale,son,griezmann,aguero,pique,robertocarlos,rivaldo,figo,cantona
```
