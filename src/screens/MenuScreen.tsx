import React from 'react';
import {Linking, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  BookOpen,
  Bug,
  HelpCircle,
  Info,
  Settings,
  Shield,
  User,
} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import {
  MenuGroup,
  MenuRow,
  NAV_HEIGHT,
  Screen,
  Text,
  TopStatusFade,
} from '../core/ui';
import {
  APP_VERSION,
  FAQ_URL,
  FEEDBACK_URL,
  PRIVACY_POLICY_URL,
} from '../core/config';
import {spacing} from '../theme';

/** In-app destinations reachable from the Menu (detail screens land later, #12). */
export type MenuItem = 'profile' | 'settings' | 'howToPlay' | 'about';

type Props = {
  /** Open a menu destination — its detail screen. Stubbed until those exist. */
  onSelectItem?: (item: MenuItem) => void;
};

/**
 * Menu — the hub on the rainbow canvas. The "Menu" wordmark is the first item in
 * the scroll content, so it scrolls off the top (Instagram-style); a faint
 * blurred status strip stays pinned. Grouped iOS-style glass cards (Account, App,
 * About) scroll beneath, blurring under the shared nav island. Nav rows open
 * in-app detail screens; FAQ and Privacy open the marketing site.
 */
export function MenuScreen({onSelectItem}: Props) {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    // Drop top/bottom safe-area edges — the scroll content owns the top inset
    // (the header scrolls away) and the shell nav owns the bottom inset.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: NAV_HEIGHT + insets.bottom + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Wordmark header — in the scroll flow, so it scrolls off the top. */}
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            {t('menu.title')}
          </Text>
        </View>

        <MenuGroup label={t('menu.account')}>
          <MenuRow
            label={t('menu.profile')}
            Icon={User}
            onPress={() => onSelectItem?.('profile')}
          />
        </MenuGroup>

        <MenuGroup label={t('menu.app')}>
          <MenuRow
            label={t('menu.howToPlay')}
            Icon={HelpCircle}
            onPress={() => onSelectItem?.('howToPlay')}
          />
          <MenuRow
            label={t('menu.settings')}
            Icon={Settings}
            onPress={() => onSelectItem?.('settings')}
          />
        </MenuGroup>

        <MenuGroup label={t('menu.about')}>
          <MenuRow
            label={t('menu.aboutMiflo')}
            Icon={Info}
            onPress={() => onSelectItem?.('about')}
          />
          <MenuRow
            label={t('menu.faq')}
            Icon={BookOpen}
            kind="link"
            onPress={() => Linking.openURL(FAQ_URL).catch(() => {})}
          />
          <MenuRow
            label={t('menu.privacy')}
            Icon={Shield}
            kind="link"
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
          />
          <MenuRow
            label={t('menu.reportBug')}
            Icon={Bug}
            kind="link"
            onPress={() => Linking.openURL(FEEDBACK_URL).catch(() => {})}
          />
        </MenuGroup>

        <Text variant="caption" color="muted" align="center" style={styles.footer}>
          {t('menu.version', {version: APP_VERSION})}
        </Text>
      </ScrollView>

      {/* Seamless frosted fade behind the status bar — content dissolves under
          it (no hard edge) as it scrolls up. */}
      <TopStatusFade />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {flex: 1},
  list: {
    gap: spacing.xl,
  },
  footer: {marginTop: spacing.sm},
});
