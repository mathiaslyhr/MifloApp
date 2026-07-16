# Verified dates of birth — Team sheet counterpart batch

`born` is required on every footballer and must never be invented, so these were
read from Wikipedia's `{{birth date}}` infobox markup via
`node scripts/wiki-player.mjs "<name>"`, 2026-07-16. They are the players the 22
counterpart XIs need and `footballers.ts` does not have yet.

Kept because deriving them is the expensive part, and because one of them is a
trap: **"Carlos Zambrano" resolves to the baseball pitcher** (born 1981-06-01),
not Peru's centre-back — the page title is `Carlos Zambrano (footballer)`.
Always check the position/nationality the script prints back.

Still unresolved: **Miguel** (Portugal's right-back, Euro 2004 final) — neither
`Miguel (footballer, born 1980)` nor `Miguel (Portuguese footballer)` is a live
title. Find the real page before adding him; do not guess a date.

| Player | born |
| --- | --- |
| Adil Rami | `1985-12-27` |
| Ainsley Maitland-Niles | `1997-08-29` |
| Amin Younes | `1993-08-06` |
| André Carrillo | `1991-06-14` |
| Bouna Sarr | `1992-01-31` |
| Carlos Zambrano (footballer) | `1989-07-10` |
| Davy Klaassen | `1993-02-21` |
| Diego Placente | `1977-04-24` |
| Edison Flores | `1994-05-14` |
| Florian Thauvin | `1993-01-26` |
| Hans-Jörg Butt | `1974-05-28` |
| Holger Badstuber | `1989-03-13` |
| Ivano Bonetti | `1964-08-01` |
| Ivica Olić | `1979-09-14` |
| Jakub Błaszczykowski | `1985-12-14` |
| Jordan Amavi | `1994-03-09` |
| José Serrizuela | `1962-06-10` |
| Juan Simón | `1960-03-02` |
| Kevin Großkreutz | `1988-07-19` |
| Kiki Musampa | `1977-07-20` |
| Luis Advíncula | `1990-03-02` |
| Maniche | `1977-11-11` |
| Marcel Schmelzer | `1988-01-22` |
| Marco Simone | `1969-01-07` |
| Miranda (footballer, born 1984) | `1984-09-07` |
| Néstor Lorenzo | `1966-02-26` |
| Nuno Valente | `1974-09-12` |
| Oscar Ruggeri | `1962-01-26` |
| Pedro Troglio | `1965-07-28` |
| Renato Tapia | `1995-07-28` |
| Roberto Mancini | `1964-11-27` |
| Roberto Sensini | `1966-10-12` |
| Sergio Goycochea | `1963-10-17` |
| Thomas Brdarić | `1975-01-23` |
| Thomas Helmer | `1965-04-21` |
| Txiki Begiristain | `1964-08-12` |
| Valère Germain | `1990-04-17` |
| Vladimir Jugović | `1969-08-30` |
| Yıldıray Baştürk | `1978-12-24` |
| Yoshimar Yotún | `1990-04-07` |
| Zoltán Sebescen | `1975-10-01` |
