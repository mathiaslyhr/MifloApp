/**
 * Live footballer tally shown above the version line in the Menu. The count is
 * read straight from the in-memory dataset via usePlayerCount, so it climbs on
 * its own the moment an OTA content pack adds players. A small green dot sends
 * out a radar "ping" ring that radiates and fades, then rests a beat before the
 * next one (ding… ding… ding…), reading as "live". Core `Animated` only (the
 * project ships no Reanimated).
 */
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Text} from '../../core/ui';
import {usePlayerCount} from '../../data/football';
import {colors, spacing} from '../../theme';

const DOT = 7;

export function PlayerCountBadge() {
  const {t} = useTranslation();
  const count = usePlayerCount();
  const ping = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ping, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        // Rest between pings — the "…" in ding… ding… ding…
        Animated.delay(1300),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ping]);

  // Ring grows out from the dot and fades to nothing; invisible while it rests.
  const ringScale = ping.interpolate({inputRange: [0, 1], outputRange: [1, 2.8]});
  const ringOpacity = ping.interpolate({inputRange: [0, 1], outputRange: [0.55, 0]});

  return (
    <View style={styles.row}>
      <View style={styles.ping}>
        <Animated.View
          style={[
            styles.ring,
            {opacity: ringOpacity, transform: [{scale: ringScale}]},
          ]}
        />
        <View style={styles.dot} />
      </View>
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
  ping: {
    width: DOT,
    height: DOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.success,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.success,
  },
});
