/**
 * @format
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text} from '../src/core/ui';

// Smoke test of the token-driven primitives. Full-screen rendering is
// verified on device (M0 gate); native-stack/screens need a device runtime.
test('renders a themed Text without crashing', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<Text variant="title">Miflo</Text>);
  });
});
