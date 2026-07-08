/**
 * Continental treble squads (league + domestic cup + Champions League in one
 * season) — a curated fact file like famousLineups.ts, because trebles can't
 * be derived from honours (domestic-cup data is too sparse and the three
 * honours would need same-season correlation).
 *
 * Only players present in footballers.ts are listed; add teammates here when
 * they join the dataset. Squad membership = played a meaningful part of that
 * season (e.g. Cancelo is deliberately absent from City 2022-23 — loaned out
 * in January).
 */
export type TrebleSquad = {
  clubId: string;
  /** Season label, e.g. '2008-09'. */
  season: string;
  playerIds: readonly string[];
};

export const TREBLE_SQUADS: readonly TrebleSquad[] = [
  {
    clubId: 'man-utd',
    season: '1998-99',
    playerIds: [
      'Beckham, David', 'Scholes, Paul', 'Schmeichel, Peter', 'Neville, Gary',
      'Giggs, Ryan', 'Keane, Roy', 'Stam, Jaap', 'Yorke, Dwight', 'Cole, Andy',
      'Solskjær, Ole Gunnar', 'Sheringham, Teddy',
    ],
  },
  {
    clubId: 'barcelona',
    season: '2008-09',
    playerIds: [
      'Messi, Lionel', 'Xavi', 'Iniesta, Andrés', 'Busquets, Sergio',
      'Piqué, Gerard', 'Puyol, Carles', 'Henry, Thierry', 'Alves, Dani',
      'Touré, Yaya', 'Cáceres, Martín', 'Eto\'o, Samuel', 'Abidal, Éric',
      'Keita, Seydou',
    ],
  },
  {
    clubId: 'inter',
    season: '2009-10',
    playerIds: [
      'Sneijder, Wesley', 'Milito, Diego', 'Zanetti, Javier',
      'Cambiasso, Esteban', 'Balotelli, Mario', 'Maicon', 'Eto\'o, Samuel',
      'Motta, Thiago', 'Lúcio', 'Samuel, Walter', 'Chivu, Cristian',
      'Pandev, Goran', 'Júlio César', 'Stanković, Dejan',
    ],
  },
  {
    clubId: 'bayern',
    season: '2012-13',
    playerIds: [
      'Müller, Thomas', 'Lahm, Philipp', 'Schweinsteiger, Bastian',
      'Neuer, Manuel', 'Robben, Arjen', 'Ribéry, Franck', 'Alaba, David',
      'Kroos, Toni', 'Mandžukić, Mario', 'Gómez, Mario', 'Shaqiri, Xherdan',
      'Martínez, Javi', 'Dante', 'Rafinha', 'Luiz Gustavo',
    ],
  },
  {
    clubId: 'barcelona',
    season: '2014-15',
    playerIds: [
      'Messi, Lionel', 'Neymar', 'Suárez, Luis', 'Iniesta, Andrés',
      'Busquets, Sergio', 'Piqué, Gerard', 'Alves, Dani', 'Rakitić, Ivan',
      'ter Stegen, Marc-André', 'Alba, Jordi', 'Pedro', 'Xavi',
      'Bravo, Claudio', 'Mascherano, Javier',
    ],
  },
  {
    clubId: 'bayern',
    season: '2019-20',
    playerIds: [
      'Lewandowski, Robert', 'Müller, Thomas', 'Neuer, Manuel',
      'Kimmich, Joshua', 'Goretzka, Leon', 'Gnabry, Serge', 'Coman, Kingsley',
      'Alaba, David', 'Davies, Alphonso', 'Perišić, Ivan', 'Coutinho, Philippe',
      'Thiago', 'Boateng, Jérôme', 'Hernández, Lucas', 'Martínez, Javi',
    ],
  },
  {
    clubId: 'man-city',
    season: '2022-23',
    playerIds: [
      'De Bruyne, Kevin', 'Walker, Kyle', 'Gündoğan, İlkay', 'Haaland, Erling',
      'Rodri', 'Grealish, Jack', 'Ederson', 'Stones, John', 'Dias, Rúben',
      'Silva, Bernardo', 'Foden, Phil', 'Aké, Nathan', 'Akanji, Manuel',
      'Álvarez, Julián', 'Mahrez, Riyad',
    ],
  },
  {
    clubId: 'psg',
    season: '2024-25',
    playerIds: [
      // Kolo Muani deliberately absent — loaned to Juventus in January.
      'Dembélé, Ousmane', 'Hakimi, Achraf', 'Vitinha', 'Marquinhos',
      'Kvaratskhelia, Khvicha', 'Doué, Désiré', 'Mendes, Nuno',
      'Neves, João', 'Ruiz, Fabián', 'Zaïre-Emery, Warren',
      'Donnarumma, Gianluigi', 'Ramos, Gonçalo', 'Barcola, Bradley',
      'Lee Kang-in',
    ],
  },
];

/** Every player id with at least one treble — drives the treble criterion. */
export const TREBLE_WINNER_IDS: ReadonlySet<string> = new Set(
  TREBLE_SQUADS.flatMap(s => s.playerIds),
);
