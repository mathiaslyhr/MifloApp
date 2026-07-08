import React, {useEffect, useState} from 'react';
import {StyleSheet, Switch, View} from 'react-native';
import {Check} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {MenuGroup, PressableScale, Text} from '../../core/ui';
import {colors, radii, spacing} from '../../theme';
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

  async function pickLanguage(pref: LanguagePreference) {
    setLang(pref);
    await setLanguagePreference(pref);
  }

  async function toggleHaptics(value: boolean) {
    setHaptics(value);
    await setHapticsPreference(value);
  }

  return (
    <MenuDetailScreen
      title={t('settings.title')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      <MenuGroup label={t('settings.language')}>
          {LANGUAGES.map((pref, i) => {
            // Danish is not selectable while disabled; English is always the
            // active choice regardless of any previously stored preference.
            const comingSoon = !DANISH_ENABLED && pref === 'da';
            const active = DANISH_ENABLED ? lang === pref : pref === 'en';
            return (
              <PressableScale
                key={pref}
                disabled={comingSoon}
                onPress={comingSoon ? undefined : () => pickLanguage(pref)}
                style={[
                  styles.row,
                  i < LANGUAGES.length - 1 && styles.divider,
                  comingSoon && styles.rowDisabled,
                ]}
                accessibilityRole="button"
                accessibilityState={{selected: active, disabled: comingSoon}}
                accessibilityLabel={langLabel[pref]}>
                <Text variant="body" style={styles.rowLabel}>
                  {langLabel[pref]}
                </Text>
                {comingSoon ? (
                  <Text variant="caption" color="tertiary">
                    {t('games.comingSoon')}
                  </Text>
                ) : active ? (
                  <Check size={20} color={colors.primary} strokeWidth={2.5} />
                ) : null}
              </PressableScale>
            );
          })}
        </MenuGroup>

        <MenuGroup>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text variant="body">{t('settings.haptics')}</Text>
              <Text variant="caption" color="tertiary">
                {t('settings.hapticsDesc')}
              </Text>
            </View>
            <Switch
              value={haptics}
              onValueChange={toggleHaptics}
              trackColor={{true: colors.primary, false: colors.divider}}
            />
          </View>
        </MenuGroup>
    </MenuDetailScreen>
  );
}

const styles = StyleSheet.create({
  body: {gap: spacing.xl},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
    borderRadius: radii.card,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassRim,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  rowDisabled: {opacity: 0.5},
  rowLabel: {flex: 1},
  rowText: {flex: 1, gap: 2},
});
