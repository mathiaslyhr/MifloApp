/**
 * HowToPlayModal — the single shared "how to play" popover behind the ? button
 * in each game header (Hattrick, Scout, Red Card). A centered surface card with
 * a small title and a few short lines. Deliberately tiny with no scroll region;
 * text runs at the small end of the scale (title 15 / lines 14).
 * Tap outside the card to dismiss.
 */
import React from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';
import {Text} from './Text';
import {radii, spacing, useThemedStyles, type Palette} from '../../theme';

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
};

export function HowToPlayModal({visible, onClose, title, lines}: Props) {
  const styles = useThemedStyles(makeStyles);
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
      gap: spacing.md,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: c.divider,
    },
  });
