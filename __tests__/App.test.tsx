/**
 * @format
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {HomeTab} from '../src/screens/tabs/HomeTab';

// Keep the smoke test hermetic: the Home tab's focus effect loads the daily
// log (AsyncStorage, fine in tests) and the friends feed (network) — stub the
// feed so nothing leaves the process.
jest.mock('../src/core/social/socialService', () => ({
  fetchFriendsFeed: jest.fn().mockResolvedValue([]),
  avatarUrlFor: jest.fn().mockReturnValue(null),
  getCachedProfile: jest.fn().mockResolvedValue(null),
}));

const Stack = createNativeStackNavigator();

// Smoke test of the Home tab. Full-screen rendering is verified on device;
// this just guards against a broken import/render. Home reads the navigator
// via useAppNavigation and useFocusEffect, so it must mount as a real screen
// inside a navigator.
test('renders the Home tab without crashing', async () => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Tabs" component={HomeTab} />
        </Stack.Navigator>
      </NavigationContainer>,
    );
    // Let the focus effect's daily-log + friends-feed promises settle inside
    // act, so their setState calls don't fire after the test ends.
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
  });
});
