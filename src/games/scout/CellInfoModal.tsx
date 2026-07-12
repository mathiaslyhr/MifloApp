/**
 * CellInfoModal — a tiny popover naming the icon in a Scout cell. Tapping a
 * flag or crest on the board opens this with the image and one line: the
 * country or club name (e.g. "Aston Villa"). Same recipe as Hattrick's
 * [[AxisInfoModal]], but the label is just a proper noun, so no i18n.
 */
import React from 'react';
import {Image, Modal, Pressable, StyleSheet} from 'react-native';
import type {ImageSourcePropType} from 'react-native';
import {Text} from '../../core/ui';
import {radii, spacing, useThemedStyles, type Palette} from '../../theme';

export type CellInfo = {
  image: ImageSourcePropType | null;
  label: string;
};

type Props = {
  /** The cell to name, or null when nothing is open. */
  info: CellInfo | null;
  onClose: () => void;
};

export function CellInfoModal({info, onClose}: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal
      visible={info != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {info?.image != null ? (
            <Image source={info.image} resizeMode="contain" style={styles.icon} />
          ) : null}
          <Text variant="body" align="center">
            {info?.label ?? ''}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: c.scrimLight,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 300,
      backgroundColor: c.surface,
      borderRadius: radii.card,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      gap: spacing.md,
    },
    icon: {width: 52, height: 52},
  });
