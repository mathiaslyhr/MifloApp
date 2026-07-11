/**
 * Host-liveness timers: the host heartbeat loop and the guest stale-room
 * watchdog. Pure timer logic, so everything runs under fake timers; AppState
 * is observed via a spy on addEventListener.
 */
import {AppState} from 'react-native';

import {
  createHostHeartbeat,
  createStaleWatchdog,
  HEARTBEAT_INTERVAL_MS,
  STALE_ROOM_TIMEOUT_MS,
} from '../liveness';

describe('createHostHeartbeat', () => {
  let appStateSpy: jest.SpyInstance;
  let appStateHandler: ((state: string) => void) | undefined;
  // Honour remove() like the real subscription: the handler stops firing.
  const removeSub = jest.fn(() => {
    appStateHandler = undefined;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    removeSub.mockClear();
    appStateHandler = undefined;
    appStateSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type: any, handler: any) => {
        appStateHandler = handler;
        return {remove: removeSub} as any;
      });
  });

  afterEach(() => {
    appStateSpy.mockRestore();
    jest.useRealTimers();
  });

  test('beats immediately and then on every interval', () => {
    const beat = jest.fn();
    const dispose = createHostHeartbeat(beat);
    expect(beat).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(beat).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);
    expect(beat).toHaveBeenCalledTimes(5);
    dispose();
  });

  test('beats immediately when the app returns to the foreground', () => {
    const beat = jest.fn();
    const dispose = createHostHeartbeat(beat);
    beat.mockClear();

    appStateHandler?.('active');
    expect(beat).toHaveBeenCalledTimes(1);
    // Non-active transitions don't beat.
    appStateHandler?.('background');
    expect(beat).toHaveBeenCalledTimes(1);
    dispose();
  });

  test('dispose stops the interval and removes the AppState listener', () => {
    const beat = jest.fn();
    const dispose = createHostHeartbeat(beat);
    dispose();
    expect(removeSub).toHaveBeenCalled();

    beat.mockClear();
    jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 4);
    appStateHandler?.('active');
    expect(beat).not.toHaveBeenCalled();
  });
});

describe('createStaleWatchdog', () => {
  let randomSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    // Pin jitter to 0 so timings are exact.
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    randomSpy.mockRestore();
    jest.useRealTimers();
  });

  test('fires onExpired once the timeout elapses without a poke', () => {
    const onExpired = jest.fn();
    const dog = createStaleWatchdog(onExpired, 90_000);

    jest.advanceTimersByTime(89_999);
    expect(onExpired).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
    // Does not auto-repeat: onExpired decides via rearm().
    jest.advanceTimersByTime(90_000 * 2);
    expect(onExpired).toHaveBeenCalledTimes(1);
    dog.dispose();
  });

  test('defaults to STALE_ROOM_TIMEOUT_MS', () => {
    const onExpired = jest.fn();
    const dog = createStaleWatchdog(onExpired);
    jest.advanceTimersByTime(STALE_ROOM_TIMEOUT_MS);
    expect(onExpired).toHaveBeenCalledTimes(1);
    dog.dispose();
  });

  test('poke resets the countdown, including after an expiry', () => {
    const onExpired = jest.fn();
    const dog = createStaleWatchdog(onExpired, 90_000);

    jest.advanceTimersByTime(80_000);
    dog.poke();
    jest.advanceTimersByTime(80_000);
    expect(onExpired).not.toHaveBeenCalled();
    jest.advanceTimersByTime(10_000);
    expect(onExpired).toHaveBeenCalledTimes(1);

    // Room events resume after an expiry (host was alive): poke re-arms the
    // full timeout again.
    dog.poke();
    jest.advanceTimersByTime(90_000);
    expect(onExpired).toHaveBeenCalledTimes(2);
    dog.dispose();
  });

  test('rearm schedules the next expiry after the given delay', () => {
    const onExpired = jest.fn();
    const dog = createStaleWatchdog(onExpired, 90_000);

    jest.advanceTimersByTime(90_000);
    expect(onExpired).toHaveBeenCalledTimes(1);

    dog.rearm(15_000);
    jest.advanceTimersByTime(14_999);
    expect(onExpired).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(onExpired).toHaveBeenCalledTimes(2);
    dog.dispose();
  });

  test('applies bounded jitter on top of the timeout', () => {
    randomSpy.mockReturnValue(1); // max jitter: +10s
    const onExpired = jest.fn();
    const dog = createStaleWatchdog(onExpired, 90_000);

    jest.advanceTimersByTime(90_000);
    expect(onExpired).not.toHaveBeenCalled();
    jest.advanceTimersByTime(10_000);
    expect(onExpired).toHaveBeenCalledTimes(1);
    dog.dispose();
  });

  test('dispose cancels the pending expiry and disables poke/rearm', () => {
    const onExpired = jest.fn();
    const dog = createStaleWatchdog(onExpired, 90_000);
    dog.dispose();

    jest.advanceTimersByTime(90_000 * 2);
    dog.poke();
    dog.rearm(1_000);
    jest.advanceTimersByTime(90_000 * 2);
    expect(onExpired).not.toHaveBeenCalled();
  });
});
