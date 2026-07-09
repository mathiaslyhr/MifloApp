/**
 * isNetworkError separates "the request never reached the server" from real
 * server rejections, so screens blame the connection, not the user's input.
 */
// isNetworkError is pure; stub the supabase client so importing the rooms
// service doesn't drag the real SDK (ESM) into jest.
jest.mock('../../supabase/client', () => ({
  supabase: null,
  ensureSession: jest.fn(),
}));

import {isNetworkError} from '../roomService';

test('matches RN fetch failures as converted by postgrest-js', () => {
  // postgrest-js turns a rejected fetch into a plain error object.
  expect(
    isNetworkError({message: 'TypeError: Network request failed', code: ''}),
  ).toBe(true);
  expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
  expect(isNetworkError({message: 'Failed to fetch'})).toBe(true);
});

test('matches auth-js retryable fetch errors', () => {
  expect(isNetworkError({name: 'AuthRetryableFetchError', status: 0})).toBe(
    true,
  );
  expect(isNetworkError({status: 0})).toBe(true);
});

test('does not match server-side rejections', () => {
  // The join_room RPC raises this for an unknown/closed code (code P0001).
  expect(
    isNetworkError({message: 'Invalid or closed code', code: 'P0001'}),
  ).toBe(false);
  expect(isNetworkError(new Error('Invalid or closed code'))).toBe(false);
  expect(isNetworkError({message: 'duplicate key value', status: 409})).toBe(
    false,
  );
  expect(isNetworkError(null)).toBe(false);
  expect(isNetworkError(undefined)).toBe(false);
});
