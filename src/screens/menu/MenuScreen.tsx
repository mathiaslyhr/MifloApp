/**
 * Menu — pushed from the Profile tab's hamburger corner button (it stopped
 * being a tab when Profile took its place). Grouped iOS-style cards:
 * App (how to play, settings) and About; FAQ, Privacy and Report a bug open
 * the marketing site. The old Account group is gone — the profile IS the
 * page you came from.
 */
import React from 'react';
import {Alert, Linking, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  BookOpen,
  Bug,
  HelpCircle,
  Info,
  Settings,
  Shield,
  Smartphone,
  SmartphoneNfc,
  Trash2,
} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import {MenuGroup, MenuRow, Text, toast} from '../../core/ui';
import {haptics} from '../../core/haptics';
import {deleteAccount} from '../../core/social/socialService';
import {
  APP_VERSION,
  FAQ_URL,
  FEEDBACK_URL,
  PRIVACY_POLICY_URL,
} from '../../core/config';
import {spacing} from '../../theme';
import type {RootStackParamList} from '../../core/navigation';
import {MenuDetailScreen} from './MenuDetailScreen';
import {PlayerCountBadge} from './PlayerCountBadge';

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

  async function runDelete() {
    try {
      await deleteAccount();
      haptics.success();
      toast.success(t('menu.deleteProfileDone'));
      // Back to the tabs; the Profile tab re-checks on focus and, finding no
      // profile, drops to the username-entry onboarding.
      navigation.popToTop();
    } catch {
      haptics.error();
      toast.error(t('menu.deleteProfileError'));
    }
  }

  // Native confirm before wiping the profile (App Store 5.1.1 deletion flow).
  function confirmDelete() {
    Alert.alert(t('menu.deleteProfileTitle'), t('menu.deleteProfileBody'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('menu.deleteProfileConfirm'),
        style: 'destructive',
        onPress: runDelete,
      },
    ]);
  }

  return (
    <MenuDetailScreen
      title={t('menu.title')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}>
      <MenuGroup label={t('menu.profile')}>
        <MenuRow
          label={t('transfer.menuRow')}
          Icon={SmartphoneNfc}
          onPress={() => navigation.navigate('MoveToPhone')}
        />
        <MenuRow
          label={t('menu.deleteProfile')}
          Icon={Trash2}
          danger
          onPress={confirmDelete}
          accessibilityHint={t('menu.deleteProfileBody')}
        />
      </MenuGroup>

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
        <MenuRow
          label={t('menu.oneDevice')}
          Icon={Smartphone}
          onPress={() => navigation.navigate('OneDevice')}
        />
      </MenuGroup>

      <MenuGroup label={t('menu.about')}>
        <MenuRow
          label={t('menu.aboutMiflo')}
          Icon={Info}
          onPress={() => navigation.navigate('About')}
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

      <View style={styles.footer}>
        <PlayerCountBadge />
        <View style={styles.footerDivider} />
        <Text variant="caption" color="muted" align="center">
          {t('menu.version', {version: APP_VERSION})}
        </Text>
      </View>
    </MenuDetailScreen>
  );
}

const styles = StyleSheet.create({
  body: {gap: spacing.xl},
  footer: {marginTop: spacing.sm, alignItems: 'center', gap: spacing.sm},
  footerDivider: {
    height: 1,
    width: 80,
    borderRadius: 1,
    backgroundColor: 'rgba(13,13,22,0.18)',
  },
});
