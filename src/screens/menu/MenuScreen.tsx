/**
 * Menu — pushed from the Profile tab's hamburger corner button (it stopped
 * being a tab when Profile took its place). Grouped iOS-style glass cards:
 * App (how to play, settings) and About; FAQ, Privacy and Report a bug open
 * the marketing site. The old Account group is gone — the profile IS the
 * page you came from.
 */
import React from 'react';
import {Linking, StyleSheet} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  BookOpen,
  Bug,
  HelpCircle,
  Info,
  Settings,
  Shield,
  Smartphone,
} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import {MenuGroup, MenuRow, Text, toast} from '../../core/ui';
import {haptics} from '../../core/haptics';
import {
  APP_VERSION,
  FAQ_URL,
  FEEDBACK_URL,
  PRIVACY_POLICY_URL,
} from '../../core/config';
import {spacing} from '../../theme';
import type {RootStackParamList} from '../../core/navigation';
import {MenuDetailScreen} from './MenuDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Menu'>;

export function MenuScreen({navigation}: Props) {
  const {t} = useTranslation();

  // External rows (FAQ/Privacy/Report a bug): say so if the link won't open.
  function openLink(url: string) {
    Linking.openURL(url).catch(() => {
      haptics.error();
      toast.error(t('menu.errorLink'));
    });
  }

  return (
    <MenuDetailScreen
      title={t('menu.title')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      <MenuGroup label={t('menu.app')}>
        <MenuRow
          label={t('menu.howToPlay')}
          Icon={HelpCircle}
          onPress={() => navigation.navigate('HowToPlay')}
        />
        <MenuRow
          label={t('menu.settings')}
          Icon={Settings}
          onPress={() => navigation.navigate('Settings')}
        />
      </MenuGroup>

      <MenuGroup label={t('menu.about')}>
        <MenuRow
          label={t('menu.aboutMiflo')}
          Icon={Info}
          onPress={() => navigation.navigate('About')}
        />
        <MenuRow
          label={t('menu.oneDevice')}
          Icon={Smartphone}
          onPress={() => navigation.navigate('OneDevice')}
        />
        <MenuRow
          label={t('menu.faq')}
          Icon={BookOpen}
          kind="link"
          onPress={() => openLink(FAQ_URL)}
        />
        <MenuRow
          label={t('menu.privacy')}
          Icon={Shield}
          kind="link"
          onPress={() => openLink(PRIVACY_POLICY_URL)}
        />
        <MenuRow
          label={t('menu.reportBug')}
          Icon={Bug}
          kind="link"
          onPress={() => openLink(FEEDBACK_URL)}
        />
      </MenuGroup>

      <Text variant="caption" color="muted" align="center" style={styles.footer}>
        {t('menu.version', {version: APP_VERSION})}
      </Text>
    </MenuDetailScreen>
  );
}

const styles = StyleSheet.create({
  body: {gap: spacing.xl},
  footer: {marginTop: spacing.sm},
});
