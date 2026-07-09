/**
 * Internationalization. Miflo ships English + Danish; every user-facing string
 * lives in `en.json` / `da.json` and is read through `t('…')` (react-i18next).
 *
 * Language resolution on boot: a saved override (Settings) → the device locale
 * (react-native-localize) → English. i18next initializes synchronously with the
 * device language so the first render is already localized; `loadStoredLanguage`
 * then applies any saved override. Changing the language re-renders live.
 */
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {findBestLanguageTag} from 'react-native-localize';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en.json';
import da from './da.json';

export const SUPPORTED_LANGUAGES = ['en', 'da'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** What the user picked in Settings — a concrete language or "follow system". */
export type LanguagePreference = 'system' | Language;

/**
 * Danish is temporarily disabled while it's still incomplete: the strings stay
 * in the codebase (`da.json`) but the app renders English for everyone. Flip to
 * `true` to restore Danish + the full three-option language picker.
 */
export const DANISH_ENABLED = false;

const STORAGE_KEY = 'app.language';

const resources = {
  en: {translation: en},
  da: {translation: da},
};

/** The device's best match among our supported languages (defaults to English). */
function deviceLanguage(): Language {
  const best = findBestLanguageTag([...SUPPORTED_LANGUAGES]);
  const tag = best?.languageTag?.toLowerCase() ?? 'en';
  return tag.startsWith('da') ? 'da' : 'en';
}

/**
 * Resolve a preference to the language we actually apply. While Danish is
 * disabled this always clamps to English, so a stored `'da'`/`'system'` value
 * (or a Danish device) never renders Danish — but is preserved for later.
 */
function resolveLanguage(pref: LanguagePreference): Language {
  const effective = pref === 'system' ? deviceLanguage() : pref;
  return DANISH_ENABLED ? effective : 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: DANISH_ENABLED ? deviceLanguage() : 'en',
  fallbackLng: 'en',
  // v3 plural/format rules avoid depending on Intl.PluralRules at runtime; we
  // interpolate counts manually so this is purely a safety choice.
  compatibilityJSON: 'v3',
  interpolation: {escapeValue: false},
  returnNull: false,
});

/** Read the saved preference ('system' when nothing is stored). */
export async function getLanguagePreference(): Promise<LanguagePreference> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'da' || saved === 'system') {
      return saved;
    }
  } catch {
    // Ignore storage errors — fall back to system.
  }
  return 'system';
}

/** Apply any saved override on boot (device language already applied at init). */
export async function loadStoredLanguage(): Promise<void> {
  const pref = await getLanguagePreference();
  const effective = resolveLanguage(pref);
  if (i18n.language !== effective) {
    await i18n.changeLanguage(effective);
  }
}

/**
 * Persist + apply a language preference (from the Settings picker). The
 * language switches first so it always applies for this session; a failed
 * write rejects so the caller can tell the user it won't survive a relaunch.
 */
export async function setLanguagePreference(pref: LanguagePreference): Promise<void> {
  const effective = resolveLanguage(pref);
  await i18n.changeLanguage(effective);
  await AsyncStorage.setItem(STORAGE_KEY, pref);
}

export default i18n;
