/**
 * Skin 3 — screen 1: the welcome screen. Skin 3 is the ground-up redesign, so
 * the app starts here as a blank slate; every other screen gets rebuilt onto
 * this new look one at a time. Until then this is the ONLY screen skin 3 renders.
 *
 * Because skin 3 is the default look and has no navigation yet, the footer taps
 * open a skin picker so the user can always drop back to the old app (Light /
 * Dark). That footer is a temporary dev affordance, not part of the design.
 */
import React from 'react';
import {ActionSheetIOS, Pressable, StatusBar, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Text} from '../../core/ui';
import {
  spacing,
  useSkin,
  useThemedStyles,
  type Palette,
} from '../../theme';

export function WelcomeScreen(): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const {setPreference} = useSkin();

  const switchSkin = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Switch skin',
        options: ['Skin 3', 'Light', 'Dark', 'Cancel'],
        cancelButtonIndex: 3,
      },
      index => {
        const pick =
          index === 0 ? 'skin3' : index === 1 ? 'light' : index === 2 ? 'dark' : null;
        if (pick) {
          setPreference(pick).catch(() => {});
        }
      },
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.center}>
        <Text variant="hero" align="center">
          Miflo
        </Text>
        <Text variant="body" color="secondary" align="center" style={styles.tagline}>
          Welcome
        </Text>
      </View>
      <Pressable
        onPress={switchSkin}
        hitSlop={16}
        style={[styles.footer, {paddingBottom: insets.bottom + spacing.lg}]}
        accessibilityRole="button"
        accessibilityLabel="Switch skin">
        <Text variant="caption" color="tertiary" align="center">
          Tap to switch skin
        </Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: c.background},
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    tagline: {},
    footer: {alignItems: 'center', paddingTop: spacing.md},
  });
