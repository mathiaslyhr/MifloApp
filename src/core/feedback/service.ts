/**
 * Feedback service — the only thing that sends user feedback to Supabase.
 * The FeedbackScreen calls `submitFeedback`; the website hits the same
 * `submit_feedback` RPC (see supabase/migrations/0007_feedback.sql).
 *
 * Like the rooms service, the write goes through a SECURITY DEFINER RPC and the
 * client only ever needs an anonymous session.
 */
import {ensureSession, supabase} from '../supabase/client';
import {APP_VERSION} from '../config';
import {BackendUnavailableError} from '../rooms/roomService';

/** The kinds of feedback a user can send; mirrors the DB check constraint. */
export type FeedbackCategory = 'general' | 'bug' | 'idea';

/**
 * Send a piece of feedback. Stamps the running app version so submissions are
 * traceable to a build. Throws `BackendUnavailableError` if Supabase isn't
 * configured, or the RPC error otherwise.
 */
export async function submitFeedback(
  category: FeedbackCategory,
  message: string,
): Promise<void> {
  if (!supabase) {
    throw new BackendUnavailableError();
  }
  await ensureSession();
  const {error} = await supabase.rpc('submit_feedback', {
    p_category: category,
    p_message: message.trim(),
    p_app_version: APP_VERSION,
    p_source: 'app',
  });
  if (error) {
    throw error;
  }
}
