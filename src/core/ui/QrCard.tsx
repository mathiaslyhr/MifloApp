import React from 'react';
import {StyleSheet, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {radii, spacing} from '../../theme';
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
        {/* Deliberately theme-fixed: scanners need dark modules on a light
            ground, so the QR stays black-on-white on every skin. */}
        <QRCode value={value} size={size} color="#000000" backgroundColor="#FFFFFF" />
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
  // White on purpose (scannable ground); no shadow — cards never carry shadow.
  card: {
    padding: 12,
    borderRadius: radii.card,
    backgroundColor: '#FFFFFF',
  },
});
