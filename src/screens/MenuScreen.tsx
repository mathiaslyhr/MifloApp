import React, {useState} from 'react';
import {Linking, ScrollView, StyleSheet, View} from 'react-native';
import {
  BookOpen,
  HelpCircle,
  Info,
  Settings,
  Shield,
  User,
} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import {
  FloatingBar,
  IslandTabBar,
  MenuGroup,
  MenuRow,
  Screen,
  TabId,
  Text,
} from '../core/ui';
import {APP_VERSION, FAQ_URL, PRIVACY_POLICY_URL} from '../core/config';
import {screenPadding, spacing} from '../theme';

/** In-app destinations reachable from the Menu (detail screens land later, #12). */
export type MenuItem = 'profile' | 'settings' | 'howToPlay' | 'about';

type Props = {
  /** Switch tabs (the nav island). */
  onTabSelect?: (id: TabId) => void;
  /** Open a menu destination — its detail screen. Stubbed until those exist. */
  onSelectItem?: (item: MenuItem) => void;
};

/**
 * Menu — the hub on the rainbow canvas. A centered "Menu" wordmark floats at the
 * top and the nav island floats at the bottom; grouped iOS-style glass cards
 * (Account, App, About) scroll the full height behind both. Nav rows open in-app
 * detail screens (stubbed for now via `onSelectItem`); the FAQ and Privacy rows
 * open the marketing site. A muted version footer sits above the nav island.
 */
export function MenuScreen({onTabSelect, onSelectItem}: Props) {
  const {t} = useTranslation();
  // Floating-bar heights, measured at layout, so the scroll content can reserve
  // matching top/bottom clearance and glide behind the chrome.
  const [topH, setTopH] = useState(0);
  const [botH, setBotH] = useState(0);

  return (
    // Drop top/bottom safe-area edges — the floating bars own those insets so the
    // menu scrolls the full height, behind the chrome, with no clip line.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.list,
          {paddingTop: topH + spacing.xl, paddingBottom: botH + spacing.xl},
        ]}
        showsVerticalScrollIndicator={false}>
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
        </MenuGroup>

        <Text variant="caption" color="muted" align="center" style={styles.footer}>
          {t('menu.version', {version: APP_VERSION})}
        </Text>
      </ScrollView>

      {/* Floating header — the wordmark, no background; the cards scroll behind
          it. */}
      <FloatingBar edge="top" onHeight={setTopH} style={styles.topBar}>
        <View style={styles.header}>
          <Text variant="wordmark" align="center">
            {t('menu.title')}
          </Text>
        </View>
      </FloatingBar>

      {/* Floating nav island (Menu active), pinned to the bottom. */}
      <FloatingBar edge="bottom" onHeight={setBotH}>
        <IslandTabBar active="menu" onSelect={onTabSelect} />
      </FloatingBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // FloatingBar spans edge-to-edge; pad it so the wordmark lines up with the
  // 16px-inset scrolled content.
  topBar: {
    paddingTop: spacing.sm,
    paddingHorizontal: screenPadding,
  },
  scroll: {flex: 1},
  list: {
    gap: spacing.xl,
  },
  footer: {marginTop: spacing.sm},
});
