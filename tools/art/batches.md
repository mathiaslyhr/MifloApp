# Portrait batch checklist

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

## Batch 1 — sent 2026-08-02 — status: sent

Reading order left→right, top→bottom = `--names` order for `grid16`.

| #  | Player            | Dataset id          | File (`--names`) | Status |
|----|-------------------|---------------------|------------------|--------|
| 1  | Pelé              | `Pelé`              | `pele`           | sent   |
| 2  | Diego Maradona    | `Maradona, Diego`   | `maradona`       | sent   |
| 3  | Kylian Mbappé     | `Mbappé, Kylian`    | `mbappe`         | sent   |
| 4  | Erling Haaland    | `Haaland, Erling`   | `haaland`        | sent   |
| 5  | Zinédine Zidane   | `Zidane, Zinédine`  | `zidane`         | sent   |
| 6  | Ronaldo Nazário   | `Ronaldo`           | `ronaldo-r9`     | sent   |
| 7  | Ronaldinho        | `Ronaldinho`        | `ronaldinho`     | sent   |
| 8  | David Beckham     | `Beckham, David`    | `beckham`        | sent   |
| 9  | Thierry Henry     | `Henry, Thierry`    | `henry`          | sent   |
| 10 | Wayne Rooney      | `Rooney, Wayne`     | `rooney`         | sent   |
| 11 | Mohamed Salah     | `Salah, Mohamed`    | `salah`          | sent   |
| 12 | Harry Kane        | `Kane, Harry`       | `kane`           | sent   |
| 13 | Jude Bellingham   | `Bellingham, Jude`  | `bellingham`     | sent   |
| 14 | Vinícius Júnior   | `Vinícius Júnior`   | `vinicius`       | sent   |
| 15 | Lamine Yamal      | `Yamal, Lamine`     | `yamal`          | sent   |
| 16 | Virgil van Dijk   | `van Dijk, Virgil`  | `vandijk`        | sent   |

Cut command once the sheet is in `tools/art/sheets/`:

```
node slice-sheet.mjs grid16 sheets/<file>.png \
  --names=pele,maradona,mbappe,haaland,zidane,ronaldo-r9,ronaldinho,beckham,henry,rooney,salah,kane,bellingham,vinicius,yamal,vandijk
```
