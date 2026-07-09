/**
 * Optimistic room state: the player's own move paints immediately, the
 * server echo stays authoritative, and a rejected RPC rolls back to the
 * last server-confirmed state.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {useOptimisticRoomState} from '../useOptimisticRoomState';

type Handle = ReturnType<typeof useOptimisticRoomState<string>>;

function renderHook(): {current: Handle} {
  const result = {current: null as unknown as Handle};
  function Harness() {
    result.current = useOptimisticRoomState<string>();
    return null;
  }
  ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<Harness />);
  });
  return result;
}

test('starts empty and follows server state', () => {
  const hook = renderHook();
  expect(hook.current.state).toBeNull();

  ReactTestRenderer.act(() => {
    hook.current.applyServer('server-1');
  });
  expect(hook.current.state).toBe('server-1');
});

test('an optimistic move is visible immediately, before the RPC settles', () => {
  const hook = renderHook();
  ReactTestRenderer.act(() => {
    hook.current.applyServer('server-1');
  });

  ReactTestRenderer.act(() => {
    void hook.current.applyOptimistic('mine', () => new Promise(() => {}));
  });
  expect(hook.current.state).toBe('mine');
});

test('a rejected RPC rolls back to the last server state and rethrows', async () => {
  const hook = renderHook();
  ReactTestRenderer.act(() => {
    hook.current.applyServer('server-1');
  });

  const failure = new Error('offline');
  let caught: unknown;
  await ReactTestRenderer.act(async () => {
    caught = await hook.current
      .applyOptimistic('mine', () => Promise.reject(failure))
      .catch(e => e);
  });

  expect(caught).toBe(failure);
  expect(hook.current.state).toBe('server-1');
});

test('a server echo that lands mid-flight wins, even over a later rollback', async () => {
  const hook = renderHook();
  ReactTestRenderer.act(() => {
    hook.current.applyServer('server-1');
  });

  let reject!: (e: Error) => void;
  let settled: Promise<unknown> = Promise.resolve();
  ReactTestRenderer.act(() => {
    settled = hook.current
      .applyOptimistic('mine', () => new Promise((_, r) => (reject = r)))
      .catch(e => e);
  });

  // Another player's move (or our own echo) arrives while the RPC is pending.
  ReactTestRenderer.act(() => {
    hook.current.applyServer('server-2');
  });

  await ReactTestRenderer.act(async () => {
    reject(new Error('rejected after echo'));
    await settled;
  });

  expect(hook.current.state).toBe('server-2');
});
