/**
 * AxisInfoModal — a tiny popover that explains ONE axis of the grid. Tapping an
 * axis header (e.g. the Argentina flag on a row) opens this with a single line:
 * "Has played for Argentina". One short sentence, so there is nothing to scroll
 * — it replaces the old full-grid legend, which never fit on a phone screen.
 * Shows the same vector illustration the board uses for that axis.
 */
import React from 'react';
import {Image, Modal, Pressable, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Text} from '../../core/ui';
import {colors, radii, spacing} from '../../theme';
import type {Criterion} from '../../data/football';
import {criterionValue} from './grid';
import {criterionImage, criterionIcon} from './criterionIcon';

type Props = {
  /** The axis to explain, or null when nothing is open. */
  criterion: Criterion | null;
  onClose: () => void;
};

export function AxisInfoModal({criterion, onClose}: Props) {
  const {t} = useTranslation();
  const image = criterion != null ? criterionImage(criterion) : null;
  const emoji = criterion != null && image == null ? criterionIcon(criterion) : null;
  return (
    <Modal
      visible={criterion != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {image != null ? (
            <Image source={image} resizeMode="contain" style={styles.icon} />
          ) : emoji != null ? (
            <Text style={styles.emoji}>{emoji}</Text>
          ) : null}
          <Text variant="body" align="center">
            {criterion != null
              ? t(
                  criterion.kind === 'honour' && criterion.honour === 'league-title'
                    ? 'legend.meaning.honourLeagueTitle'
                    : `legend.meaning.${criterion.kind}`,
                  {value: criterionValue(criterion)},
                )
              : ''}
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
    maxWidth: 300,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {width: 52, height: 52},
  emoji: {fontSize: 44, lineHeight: 52, textAlign: 'center'},
});
