/**
 * HelpModal — the "how to play" popover behind the ? button in the game header.
 * A couple of short lines: the core rule plus a nudge that every axis on the
 * grid is tappable (see [[AxisInfoModal]]) for a plain-language explanation.
 * Deliberately tiny with no scroll region.
 */
import React from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Text} from '../../core/ui';
import {colors, radii, spacing} from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function HelpModal({visible, onClose}: Props) {
  const {t} = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text variant="label" align="center">
            {t('hattrick.help.title')}
          </Text>
          <Text variant="body" color="secondary" align="center">
            {t('hattrick.help.rule')}
          </Text>
          <View style={styles.divider} />
          <Text variant="body" align="center">
            {t('hattrick.help.tapHint')}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrimLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.divider,
  },
});
