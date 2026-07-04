/**
 * Miflo — social party games for friends in the same room.
 *
 * The frontend was reset to a blank slate; this shell just mounts the single
 * Home page. The game engine, football data and Supabase backend live on under
 * `src/` and will be wired into the new frontend as it's built.
 *
 * @format
 */
import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {HomeScreen} from './src/screens/HomeScreen';
import {ensureSession} from './src/core/supabase/client';

function App(): React.JSX.Element {
  // Sign in anonymously up front so rooms feel instant; non-fatal and a no-op
  // when the backend isn't configured.
  useEffect(() => {
    ensureSession().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <HomeScreen />
    </SafeAreaProvider>
  );
}

export default App;
