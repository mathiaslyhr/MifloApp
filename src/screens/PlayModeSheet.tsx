import React from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Smartphone, Users} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import {GlassCard, PressableScale, Text} from '../core/ui';
import {haptics} from '../core/haptics';
import {colors, spacing} from '../theme';

type Props = {
  visible: boolean;
  /** Play pass-and-play on this phone (no room, works offline). */
  onLocal: () => void;
  /** Mint a party and head to the lobby — today's online flow. */
  onOnline: () => void;
  onClose: () => void;
};

/**
 * Bottom-anchored mode chooser for games that support pass-and-play: tapping
 * such a game on the Games hub asks "On this phone" vs "Online with friends"
 * before anything touches the network, so the local path works in flight mode.
 * Frosted glass card over a scrim, same material as the in-game overlays.
 */
export function PlayModeSheet({visible, onLocal, onOnline, onClose}: Props) {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        {/* Card swallows taps so only the scrim dismisses. */}
        <Pressable
          style={[styles.holder, {marginBottom: insets.bottom + spacing.xl}]}
          onPress={() => {}}>
          <GlassCard blur={24} style={styles.card}>
            <Text variant="section" align="center" style={styles.title}>
              {t('games.playMode.title')}
            </Text>
            <ModeRow
              Icon={Smartphone}
              label={t('games.playMode.local')}
              sub={t('games.playMode.localSub')}
              onPress={() => {
                haptics.tap();
                onLocal();
              }}
            />
            <View style={styles.divider} />
            <ModeRow
              Icon={Users}
              label={t('games.playMode.online')}
              sub={t('games.playMode.onlineSub')}
              onPress={() => {
                haptics.tap();
                onOnline();
              }}
            />
          </GlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ModeRow({
  Icon,
  label,
  sub,
  onPress,
}: {
  Icon: typeof Smartphone;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <View style={styles.rowIcon}>
        <Icon size={22} color={colors.ink} strokeWidth={1.6} />
      </View>
      <View style={styles.rowText}>
        <Text variant="body">{label}</Text>
        <Text variant="secondary" color="secondary">
          {sub}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
  },
  holder: {alignSelf: 'stretch'},
  card: {padding: spacing.md},
  title: {paddingVertical: spacing.sm},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  rowIcon: {width: 28, alignItems: 'center'},
  rowText: {flex: 1, gap: 2},
  divider: {height: 1, backgroundColor: colors.glassRim},
});
