// Feedback → email forwarder.
//
// The app writes every submission to the `feedback` table via the
// `submit_feedback` RPC (that's the durable record). Right after, the client
// calls this function best-effort so the report also lands in the support
// inbox. If this fails, the DB row still exists — no feedback is lost.
//
// Invoked with the submitter's anonymous JWT (verify_jwt stays on), so only a
// signed-in app session can reach it. Sends via Resend.
//
// Deploy:  supabase functions deploy feedback-email
// Secrets: supabase secrets set RESEND_API_KEY=…            (required)
//          supabase secrets set FEEDBACK_FROM='Miflo <feedback@miflo.dk>'  (optional)
//          supabase secrets set FEEDBACK_TO=hello@miflo.dk                 (optional)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = Deno.env.get('FEEDBACK_FROM') ?? 'Miflo Feedback <feedback@miflo.dk>';
const TO = Deno.env.get('FEEDBACK_TO') ?? 'hello@miflo.dk';

const CATEGORY_LABEL: Record<string, string> = {
  bug: '🐞 Bug',
  idea: '💡 Idea',
  general: '💬 Feedback',
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: cors});
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({error: 'RESEND_API_KEY not set'}), {
      status: 500,
      headers: {...cors, 'Content-Type': 'application/json'},
    });
  }

  let body: {
    category?: string;
    message?: string;
    appVersion?: string;
    source?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({error: 'Invalid JSON'}), {
      status: 400,
      headers: {...cors, 'Content-Type': 'application/json'},
    });
  }

  const message = (body.message ?? '').trim();
  if (!message) {
    return new Response(JSON.stringify({error: 'Message is required'}), {
      status: 400,
      headers: {...cors, 'Content-Type': 'application/json'},
    });
  }

  const category = body.category ?? 'general';
  const label = CATEGORY_LABEL[category] ?? CATEGORY_LABEL.general;
  const source = body.source ?? 'app';
  const version = body.appVersion ?? 'unknown';

  const subject = `${label} — Miflo (${source} ${version})`;
  const html =
    `<p style="white-space:pre-wrap;font-size:16px;line-height:1.5">${esc(message)}</p>` +
    `<hr style="border:none;border-top:1px solid #eee;margin:24px 0" />` +
    `<p style="color:#888;font-size:13px">${esc(label)} · ${esc(source)} · v${esc(version)}</p>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: TO,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return new Response(JSON.stringify({error: 'Resend failed', detail}), {
      status: 502,
      headers: {...cors, 'Content-Type': 'application/json'},
    });
  }

  return new Response(JSON.stringify({ok: true}), {
    headers: {...cors, 'Content-Type': 'application/json'},
  });
});
