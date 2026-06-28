/**
 * Miflo — social party games for friends in the same room.
 * App 1: a football trivia quiz. This shell is game-agnostic; games plug in
 * via the Home hub + registry.
 *
 * @format
 */
import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {RootNavigator} from './src/core/navigation/RootNavigator';
import {ensureSession} from './src/core/supabase/client';

function App(): React.JSX.Element {
  // Sign in anonymously up front so rooms feel instant; non-fatal and a no-op
  // when the backend isn't configured.
  useEffect(() => {
    ensureSession().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}

export default App;
