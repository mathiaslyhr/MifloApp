/**
 * HowToPlayModal — the single shared "how to play" popover behind the ? button
 * in each game header (Hattrick, Scout, Red Card). A centered surface card with
 * a small title, a few short lines, and a Close button. Deliberately tiny with
 * no scroll region; text runs at the small end of the scale (title 15 / lines 14).
 * Tap outside or Close to dismiss.
 */
import React from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';
import {Text} from './Text';
import {Button} from './Button';
import {colors, radii, spacing} from '../../theme';

export type HelpLine = {
  text: string;
  /** `strong` uses primary ink (the emphasis line); default is secondary. */
  tone?: 'default' | 'strong';
  /** Render a hairline divider above this line. */
  divider?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  lines: HelpLine[];
  closeLabel: string;
};

export function HowToPlayModal({visible, onClose, title, lines, closeLabel}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text variant="label" align="center">
            {title}
          </Text>
          {lines.map((line, i) => (
            <React.Fragment key={i}>
              {line.divider ? <View style={styles.divider} /> : null}
              <Text
                variant="secondary"
                color={line.tone === 'strong' ? 'primary' : 'secondary'}
                align="center">
                {line.text}
              </Text>
            </React.Fragment>
          ))}
          <Button label={closeLabel} variant="secondary" onPress={onClose} />
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
    gap: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.divider,
  },
});
