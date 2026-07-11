/**
 * Live footballer tally shown above the version line in the Menu. The count is
 * read straight from the in-memory dataset via usePlayerCount, so it climbs on
 * its own the moment an OTA content pack adds players. A small green dot pulses
 * beside it to read as "live". Core `Animated` only (the project ships no
 * Reanimated).
 */
import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Text} from '../../core/ui';
import {usePlayerCount} from '../../data/football';
import {colors, spacing} from '../../theme';

export function PlayerCountBadge() {
  const {t} = useTranslation();
  const count = usePlayerCount();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 1, duration: 900, useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 0, duration: 900, useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({inputRange: [0, 1], outputRange: [1, 0.35]});
  const scale = pulse.interpolate({inputRange: [0, 1], outputRange: [1, 0.7]});

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.dot, {opacity, transform: [{scale}]}]} />
      <Text variant="caption" color="muted">
        {t('menu.playerCount', {n: count.toLocaleString()})}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
});
