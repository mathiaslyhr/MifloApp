/**
 * Danish display names for the dataset's nationality strings (which are stable
 * English names, also used as flag keys). This lives in TS rather than the
 * i18n JSON because the keys are dataset values, not UI copy — the en/da
 * parity test only guards the JSON bundles. Unmapped countries fall back to
 * the English name, so a new nationality never breaks a prompt.
 */

const NATION_NAMES_DA: Record<string, string> = {
  Algeria: 'Algeriet',
  Armenia: 'Armenien',
  Australia: 'Australien',
  Austria: 'Østrig',
  Belgium: 'Belgien',
  'Bosnia and Herzegovina': 'Bosnien-Hercegovina',
  Brazil: 'Brasilien',
  Bulgaria: 'Bulgarien',
  Cameroon: 'Cameroun',
  Croatia: 'Kroatien',
  Curacao: 'Curaçao',
  'Czech Republic': 'Tjekkiet',
  Denmark: 'Danmark',
  Ecuador: 'Ecuador',
  Egypt: 'Egypten',
  Estonia: 'Estland',
  France: 'Frankrig',
  Georgia: 'Georgien',
  Germany: 'Tyskland',
  Greece: 'Grækenland',
  Hungary: 'Ungarn',
  Iceland: 'Island',
  Ireland: 'Irland',
  Italy: 'Italien',
  'Ivory Coast': 'Elfenbenskysten',
  Lithuania: 'Litauen',
  Morocco: 'Marokko',
  Netherlands: 'Holland',
  'North Macedonia': 'Nordmakedonien',
  'Northern Ireland': 'Nordirland',
  Norway: 'Norge',
  Poland: 'Polen',
  Romania: 'Rumænien',
  Russia: 'Rusland',
  'Saudi Arabia': 'Saudi-Arabien',
  Scotland: 'Skotland',
  Serbia: 'Serbien',
  Slovakia: 'Slovakiet',
  Slovenia: 'Slovenien',
  'South Africa': 'Sydafrika',
  'South Korea': 'Sydkorea',
  Spain: 'Spanien',
  Sweden: 'Sverige',
  Switzerland: 'Schweiz',
  'Trinidad and Tobago': 'Trinidad og Tobago',
  Tunisia: 'Tunesien',
  Turkey: 'Tyrkiet',
  Ukraine: 'Ukraine',
  Uzbekistan: 'Usbekistan',
};

/** A country's display name in the given UI language ('da' localizes). */
export function countryName(country: string, language: string): string {
  if (language.startsWith('da')) {
    return NATION_NAMES_DA[country] ?? country;
  }
  return country;
}
