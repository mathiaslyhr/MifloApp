/**
 * ensureSession is the identity gate: the whole point of these tests is that a
 * missing live session recovers the SAME uid from the Keychain vault and NEVER
 * silently signs in a new anonymous user over one we've had before (the bug
 * that logged a user out and forced a second profile).
 */

type AuthMock = {
  getSession: jest.Mock;
  refreshSession: jest.Mock;
  signInAnonymously: jest.Mock;
  onAuthStateChange: jest.Mock;
};

const saveSession = jest.fn(async () => {});
const readSession = jest.fn(async () => null as unknown);

/**
 * Wire up fresh module mocks (supabase-js + the vault) and import a clean copy
 * of client.ts, so each scenario gets its own auth mock and listener.
 */
function loadClient(auth: AuthMock) {
  jest.resetModules();
  saveSession.mockClear();
  readSession.mockReset();
  readSession.mockResolvedValue(null);

  jest.doMock('@supabase/supabase-js', () => ({
    createClient: () => ({auth}),
  }));
  jest.doMock('../../identity/sessionVault', () => ({saveSession, readSession}));

  return require('../client') as typeof import('../client');
}

function makeAuth(overrides: Partial<AuthMock> = {}): AuthMock {
  return {
    getSession: jest.fn(async () => ({data: {session: null}})),
    refreshSession: jest.fn(async () => ({data: {session: null}, error: null})),
    signInAnonymously: jest.fn(async () => ({data: {user: {id: 'NEW'}}, error: null})),
    onAuthStateChange: jest.fn(),
    ...overrides,
  };
}

describe('ensureSession', () => {
  it('returns the live session uid without touching recovery or sign-in', async () => {
    const auth = makeAuth({
      getSession: jest.fn(async () => ({data: {session: {user: {id: 'U1'}}}})),
    });
    const {ensureSession} = loadClient(auth);

    await expect(ensureSession()).resolves.toBe('U1');
    expect(auth.refreshSession).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('recovers the same uid from the vault when the live session is gone', async () => {
    const auth = makeAuth({
      refreshSession: jest.fn(async () => ({
        data: {session: {user: {id: 'U1'}}},
        error: null,
      })),
    });
    const {ensureSession} = loadClient(auth);
    readSession.mockResolvedValue({refreshToken: 'r-token', uid: 'U1'});

    await expect(ensureSession()).resolves.toBe('U1');
    expect(auth.refreshSession).toHaveBeenCalledWith({
      refresh_token: 'r-token',
    });
    // The core guarantee: no new identity minted when we had one.
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('signs in anonymously exactly once on a genuine first run (empty vault)', async () => {
    const auth = makeAuth();
    const {ensureSession} = loadClient(auth);
    readSession.mockResolvedValue(null);

    await expect(ensureSession()).resolves.toBe('NEW');
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('fails closed (null, never a new uid) when vault recovery fails', async () => {
    const auth = makeAuth({
      refreshSession: jest.fn(async () => ({
        data: {session: null},
        error: {message: 'invalid_grant'},
      })),
    });
    const {ensureSession} = loadClient(auth);
    readSession.mockResolvedValue({refreshToken: 'dead', uid: 'U1'});

    await expect(ensureSession()).resolves.toBeNull();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('mirrors a refreshed session into the vault via the auth listener', async () => {
    const auth = makeAuth();
    loadClient(auth);

    expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    const listener = auth.onAuthStateChange.mock.calls[0][0] as (
      event: string,
      session: unknown,
    ) => void;
    listener('TOKEN_REFRESHED', {refresh_token: 'fresh', user: {id: 'U1'}});

    expect(saveSession).toHaveBeenCalledWith({refreshToken: 'fresh', uid: 'U1'});
  });
});
