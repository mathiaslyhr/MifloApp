/**
 * @format
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {NavigationContainer} from '@react-navigation/native';
import {HomeScreen} from '../src/screens/HomeScreen';

// Smoke test of the Home landing page. Full-screen rendering is verified on
// device; this just guards against a broken import/render. Home reads the
// navigator via useAppNavigation, so it needs a container around it.
test('renders the Home screen without crashing', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(
      <NavigationContainer>
        <HomeScreen />
      </NavigationContainer>,
    );
  });
});
