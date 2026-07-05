import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {HomeScreen} from './HomeScreen';
import {GamesScreen} from './GamesScreen';
import {MenuScreen} from './MenuScreen';
import type {TabId} from '../core/ui';

/**
 * The tab shell — the stack's home route. A minimal, hand-rolled toggle between
 * Home, Games and Menu (the floating nav island drives it). All three stay
 * mounted; we flip visibility instead of swapping, so switching tabs never
 * re-rasterizes a screen's rainbow mesh SVG (a visible flash otherwise).
 *
 * The Menu's detail screens (#12) aren't built yet, so tapping a menu row is a
 * no-op for now. Home's Create button pushes the Lobby via the root stack.
 */
export function TabsScreen() {
  const [tab, setTab] = useState<TabId>('home');

  return (
    <View style={styles.root}>
      <View
        style={[styles.page, tab !== 'home' && styles.hidden]}
        pointerEvents={tab === 'home' ? 'auto' : 'none'}>
        <HomeScreen onTabSelect={setTab} />
      </View>
      <View
        style={[styles.page, tab !== 'games' && styles.hidden]}
        pointerEvents={tab === 'games' ? 'auto' : 'none'}>
        <GamesScreen onTabSelect={setTab} />
      </View>
      <View
        style={[styles.page, tab !== 'menu' && styles.hidden]}
        pointerEvents={tab === 'menu' ? 'auto' : 'none'}>
        <MenuScreen onTabSelect={setTab} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  page: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  hidden: {display: 'none'},
});
