import React, {useEffect, useState} from 'react';
import {StyleSheet, Switch} from 'react-native';
import {Check} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {MenuGroup, MenuRow, Text, toast} from '../../core/ui';
import {colors, spacing} from '../../theme';
import type {RootStackParamList} from '../../core/navigation';
import {MenuDetailScreen} from './MenuDetailScreen';
import {
  DANISH_ENABLED,
  getLanguagePreference,
  setLanguagePreference,
  type LanguagePreference,
} from '../../core/i18n';
import {
  getHapticsPreference,
  setHapticsPreference,
} from '../../core/settings/preferences';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

// While Danish is disabled we drop "System default" (it'd only resolve to
// English anyway) and show Danish as a greyed-out "Coming soon" row.
const LANGUAGES: LanguagePreference[] = DANISH_ENABLED
  ? ['system', 'en', 'da']
  : ['en', 'da'];

/** Settings — language and haptics. Both persist and apply immediately. */
export function SettingsScreen({navigation}: Props) {
  const {t} = useTranslation();
  const [lang, setLang] = useState<LanguagePreference>('system');
  const [haptics, setHaptics] = useState(true);

  useEffect(() => {
    getLanguagePreference().then(setLang).catch(() => {});
    getHapticsPreference().then(setHaptics).catch(() => {});
  }, []);

  const langLabel: Record<LanguagePreference, string> = {
    system: t('settings.languageSystem'),
    en: t('settings.languageEn'),
    da: t('settings.languageDa'),
  };

  // Both changes apply in-session even when the write fails — the toast warns
  // that the choice won't survive a relaunch. No haptic on purpose: a buzz
  // right after switching haptics off would contradict the toggle.
  async function pickLanguage(pref: LanguagePreference) {
    setLang(pref);
    try {
      await setLanguagePreference(pref);
    } catch {
      toast.error(t('settings.errorSave'));
    }
  }

  async function toggleHaptics(value: boolean) {
    setHaptics(value);
    try {
      await setHapticsPreference(value);
    } catch {
      toast.error(t('settings.errorSave'));
    }
  }

  return (
    <MenuDetailScreen
      title={t('settings.title')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      <MenuGroup label={t('settings.language')}>
        {LANGUAGES.map(pref => {
          // Danish is not selectable while disabled; English is always the
          // active choice regardless of any previously stored preference.
          const comingSoon = !DANISH_ENABLED && pref === 'da';
          const active = DANISH_ENABLED ? lang === pref : pref === 'en';
          return (
            <MenuRow
              key={pref}
              label={langLabel[pref]}
              onPress={() => pickLanguage(pref)}
              disabled={comingSoon}
              selected={active}
              accessory={
                comingSoon ? (
                  <Text variant="caption" color="tertiary">
                    {t('games.comingSoon')}
                  </Text>
                ) : active ? (
                  <Check size={20} color={colors.primary} strokeWidth={2.5} />
                ) : null
              }
            />
          );
        })}
      </MenuGroup>

      <MenuGroup>
        <MenuRow
          label={t('settings.haptics')}
          subtitle={t('settings.hapticsDesc')}
          accessory={
            <Switch
              value={haptics}
              onValueChange={toggleHaptics}
              trackColor={{true: colors.primary, false: colors.divider}}
            />
          }
        />
      </MenuGroup>
    </MenuDetailScreen>
  );
}

const styles = StyleSheet.create({
  body: {gap: spacing.xl},
});
