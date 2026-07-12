/**
 * The friend-code block inside the You card: YOUR CODE eyebrow, the six
 * characters as a deliberate 20pt "moment", and a round share icon button
 * (an icon because the old text button overflowed narrow screens). A hairline
 * divider below hands off to the game rows.
 */
import React from 'react';
import {Share, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Share as ShareIcon} from 'lucide-react-native';
import {CircleButton, Text} from '../../core/ui';
import {ADD_URL_BASE} from '../../core/config';
import {
  fonts,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../../theme';

type Props = {
  code: string;
  /** The trailing hairline handing off to rows below; off when card-final. */
  divider?: boolean;
};

export function CodeBlock({code, divider = true}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text variant="caption" color="tertiary" style={styles.eyebrow}>
            {t('social.yourCode').toUpperCase()}
          </Text>
          <Text style={styles.code} accessibilityLabel={code}>
            {code}
          </Text>
        </View>
        <CircleButton
          onPress={() =>
            Share.share({
              message: t('social.shareMessage', {
                code,
                link: `${ADD_URL_BASE}/${code}`,
              }),
            }).catch(() => {})
          }
          accessibilityLabel={t('social.a11yShareCode')}>
          <ShareIcon size={18} color={colors.ink} strokeWidth={2} />
        </CircleButton>
      </View>
      {divider ? <View style={styles.divider} /> : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    col: {gap: 2},
    eyebrow: {letterSpacing: 1},
    // The code is a deliberate "moment": wordmark weight at the scale's 20 cap,
    // spaced out so the six characters read one by one.
    code: {
      fontFamily: fonts.medium,
      fontSize: 20,
      lineHeight: 24,
      letterSpacing: 4,
      color: c.ink,
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.glassRim,
      marginTop: spacing.sm,
    },
  });
