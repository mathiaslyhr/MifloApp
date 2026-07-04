/**
 * @format
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {HomeScreen} from '../src/screens/HomeScreen';

// Smoke test of the blank Home landing page. Full-screen rendering is verified
// on device; this just guards against a broken import/render.
test('renders the Home screen without crashing', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<HomeScreen />);
  });
});
