import React from 'react';
import {Linking, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
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
  IslandTabBar,
  MenuGroup,
  MenuRow,
  Screen,
  TabId,
  Text,
} from '../core/ui';
import {APP_VERSION, FAQ_URL, PRIVACY_POLICY_URL} from '../core/config';
import {spacing} from '../theme';

/** In-app destinations reachable from the Menu (detail screens land later, #12). */
export type MenuItem = 'profile' | 'settings' | 'howToPlay' | 'about';

type Props = {
  /** Switch tabs (the nav island). */
  onTabSelect?: (id: TabId) => void;
  /** Open a menu destination — its detail screen. Stubbed until those exist. */
  onSelectItem?: (item: MenuItem) => void;
};

/**
 * Menu — the hub on the rainbow canvas. A centered "Menu" wordmark over grouped,
 * iOS-style glass cards: Account, App and About. Nav rows open in-app detail
 * screens (stubbed for now via `onSelectItem`); the FAQ and Privacy rows open
 * the marketing site. A muted version footer sits above the nav island.
 */
/** Space the list reserves at its foot so the last row clears the floating island. */
const TAB_CLEARANCE = 96;

export function MenuScreen({onTabSelect, onSelectItem}: Props) {
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();

  return (
    // Drop the bottom safe-area edge so the scroll region runs to the physical
    // bottom — content glides all the way behind the floating island (below), no
    // hard clip line. The island manages the bottom inset itself.
    <Screen canvas edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text variant="wordmark" align="center">
          {t('menu.title')}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.list,
          {paddingBottom: insets.bottom + TAB_CLEARANCE},
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

      {/* Floating overlay — pinned above the content, translucent so the list
          scrolls under it. `box-none` lets scroll gestures pass through the
          empty areas beside the pill. */}
      <View
        style={[styles.tabOverlay, {paddingBottom: insets.bottom}]}
        pointerEvents="box-none">
        <IslandTabBar active="menu" onSelect={onTabSelect} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.sm,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {flex: 1},
  list: {
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  footer: {marginTop: spacing.sm},
  tabOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
