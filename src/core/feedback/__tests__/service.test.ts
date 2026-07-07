/**
 * @format
 */
import {APP_VERSION} from '../../config';

const rpc = jest.fn();
const invoke = jest.fn();
const ensureSession = jest.fn();

function loadService(supabaseValue: unknown) {
  jest.resetModules();
  jest.doMock('../../supabase/client', () => ({
    supabase: supabaseValue,
    ensureSession,
  }));
  // Required after the mock is registered so it picks up the mocked client.
  return require('../service') as typeof import('../service');
}

describe('submitFeedback', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({error: null});
    invoke.mockReset().mockResolvedValue({error: null});
    ensureSession.mockReset().mockResolvedValue('user-1');
  });

  it('ensures a session and calls submit_feedback with trimmed args', async () => {
    const {submitFeedback} = loadService({rpc, functions: {invoke}});

    await submitFeedback('idea', '  add dark mode  ');

    expect(ensureSession).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('submit_feedback', {
      p_category: 'idea',
      p_message: 'add dark mode',
      p_app_version: APP_VERSION,
      p_source: 'app',
    });
  });

  it('forwards the trimmed feedback to the email function', async () => {
    const {submitFeedback} = loadService({rpc, functions: {invoke}});

    await submitFeedback('bug', '  crash on start  ');

    expect(invoke).toHaveBeenCalledWith('feedback-email', {
      body: {
        category: 'bug',
        message: 'crash on start',
        appVersion: APP_VERSION,
        source: 'app',
      },
    });
  });

  it('still resolves when the email forward fails', async () => {
    invoke.mockRejectedValue(new Error('smtp down'));
    const {submitFeedback} = loadService({rpc, functions: {invoke}});

    await expect(submitFeedback('bug', 'crash')).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('throws BackendUnavailableError when the backend is not configured', async () => {
    const service = loadService(null);
    const {BackendUnavailableError} = require('../../rooms/roomService');

    await expect(service.submitFeedback('general', 'hi')).rejects.toBeInstanceOf(
      BackendUnavailableError,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rethrows the RPC error', async () => {
    rpc.mockResolvedValue({error: new Error('boom')});
    const {submitFeedback} = loadService({rpc});

    await expect(submitFeedback('bug', 'crash')).rejects.toThrow('boom');
  });
});
