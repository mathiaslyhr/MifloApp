/**
 * Miflo — social party games for friends in the same room.
 * App 1: a football trivia quiz. This shell is game-agnostic; games plug in
 * via the Home hub + registry.
 *
 * @format
 */
import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {RootNavigator} from './src/core/navigation/RootNavigator';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}

export default App;
