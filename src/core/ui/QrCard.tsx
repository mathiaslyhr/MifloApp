import React from 'react';
import {StyleSheet, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {colors, radii, spacing} from '../../theme';
import {Text} from './Text';

type Props = {
  /** Encoded URL (Home passes `APP_STORE_URL`). */
  value: string;
  caption?: string;
  size?: number;
};

/**
 * A real, scannable QR in a white rounded card with a caption below — the Home
 * "scan to get the app" affordance.
 */
export function QrCard({value, caption = 'Scan to get the app', size = 108}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <QRCode
          value={value}
          size={size}
          color={colors.ink}
          backgroundColor={colors.surface}
        />
      </View>
      {caption ? (
        <Text variant="caption" color="muted" align="center">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center', gap: spacing.md},
  card: {
    padding: 12,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    shadowColor: '#140F32',
    shadowOpacity: 0.12,
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 20,
    elevation: 4,
  },
});
