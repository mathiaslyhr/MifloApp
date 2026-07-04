/**
 * Miflo — social party games for friends in the same room.
 *
 * The frontend was reset to a blank slate; this shell just mounts the single
 * Home page. The game engine, football data and Supabase backend live on under
 * `src/` and will be wired into the new frontend as it's built.
 *
 * @format
 */
import React, {useEffect, useState} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {HomeScreen} from './src/screens/HomeScreen';
import {GamesScreen} from './src/screens/GamesScreen';
import type {TabId} from './src/core/ui';
import {ensureSession} from './src/core/supabase/client';

function App(): React.JSX.Element {
  // Minimal tab shell: the nav island switches between Home and Games. The Menu
  // tab has no screen yet (screen #4) so selecting it is a no-op for now.
  const [tab, setTab] = useState<TabId>('home');
  const onTabSelect = (id: TabId) => {
    if (id === 'home' || id === 'games') {
      setTab(id);
    }
  };

  // Sign in anonymously up front so rooms feel instant; non-fatal and a no-op
  // when the backend isn't configured.
  useEffect(() => {
    ensureSession().catch(() => {});
  }, []);

  // Both chrome screens stay mounted; we toggle visibility instead of swapping.
  // Re-mounting a screen would re-rasterize its rainbow mesh SVG on every tab
  // change (a visible flash) — keeping them alive makes switching instant.
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <View style={styles.root}>
        <View
          style={[styles.page, tab !== 'home' && styles.hidden]}
          pointerEvents={tab === 'home' ? 'auto' : 'none'}>
          <HomeScreen onTabSelect={onTabSelect} />
        </View>
        <View
          style={[styles.page, tab !== 'games' && styles.hidden]}
          pointerEvents={tab === 'games' ? 'auto' : 'none'}>
          <GamesScreen onTabSelect={onTabSelect} />
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  page: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  hidden: {display: 'none'},
});

export default App;
