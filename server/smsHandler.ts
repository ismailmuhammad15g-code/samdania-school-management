// SMS gateway for the school software.
//
// One handler, two hosts: `api/sms.ts` exposes it as a Vercel Function in
// production and `vite.config.ts` mounts it on the dev server, so the browser
// always calls the same-origin `/api/sms`. The SMS.net.bd API key stays on the
// server (never a VITE_* variable) and only a signed-in website admin can use it.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatBangladeshMobile } from '../src/lib/digitUtils.js';

const SMS_API = 'https://api.sms.net.bd';
const MAX_RECIPIENTS = 1000;
const MAX_MESSAGE_LENGTH = 1000;
const PROVIDER_TIMEOUT_MS = 20_000;
const AUTH_TIMEOUT_MS = 8_000;

type ProviderResponse = {
  error?: number | string;
  msg?: string;
  data?: {
    request_id?: number | string;
    request_status?: string;
    request_charge?: string;
    balance?: string;
    recipients?: Array<{ number: string; charge: string; status: string }>;
  };
};

const PROVIDER_ERRORS: Record<number, string> = {
  400: 'SMS provider rejected a missing or invalid parameter.',
  403: "SMS provider denied this account's permission.",
  404: 'SMS provider endpoint was not found.',
  405: 'SMS provider requires authorization. Check SMS_NET_BD_API_KEY on the server.',
  409: 'SMS provider reported an internal error.',
  410: 'SMS account is expired.',
  411: 'SMS reseller account is expired or suspended.',
  412: 'SMS schedule is invalid.',
  413: 'SMS sender ID is not approved.',
  414: 'SMS message is empty.',
  415: 'SMS message is too long.',
  416: 'No valid Bangladesh phone number was found.',
  417: 'SMS account has insufficient balance.',
  420: 'SMS content was blocked by the provider.',
  421: 'This account can send only to its registered number until the first balance recharge.',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function getSmsConfig() {
  const apiKey = env('SMS_NET_BD_API_KEY');
  if (!apiKey) return null;
  return { apiKey, senderId: env('SMS_NET_BD_SENDER_ID'), contentId: env('SMS_NET_BD_CONTENT_ID') };
}

// The same public project settings the browser uses: environment first, then the
// deployed public/supabase-config.json (the browser falls back to it too).
function getSupabaseConfig(): { url: string; anonKey: string } | null {
  let url = env('SUPABASE_URL') ?? env('VITE_SUPABASE_URL');
  let anonKey = env('SUPABASE_ANON_KEY') ?? env('VITE_SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    try {
      const file = join(process.cwd(), 'public', 'supabase-config.json');
      if (existsSync(file)) {
        const saved = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
        if (!url && typeof saved.VITE_SUPABASE_URL === 'string') url = saved.VITE_SUPABASE_URL.trim();
        if (!anonKey && typeof saved.VITE_SUPABASE_ANON_KEY === 'string') anonKey = saved.VITE_SUPABASE_ANON_KEY.trim();
      }
    } catch {
      /* unreadable config file — treated as missing below */
    }
  }
  if (!url || !anonKey) return null;
  url = url.replace(/\/+$/, '');
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return null;
  } catch {
    return null;
  }
  return { url, anonKey };
}

// Only a Supabase Auth user flagged `app_metadata.main_madrasah_admin` may spend SMS credit.
// Returns the error response to send, or null when the caller is an authorized admin.
async function rejectUnlessAdmin(request: Request): Promise<Response | null> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return json({ message: 'Sign out and sign in again to use SMS from the school software.' }, 401);
  }
  const supabase = getSupabaseConfig();
  if (!supabase) {
    return json({ message: 'The SMS server has no Supabase settings. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL / SUPABASE_ANON_KEY) on the server.' }, 503);
  }

  let response: Response;
  try {
    response = await fetch(`${supabase.url}/auth/v1/user`, {
      headers: { apikey: supabase.anonKey, Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });
  } catch (error) {
    console.error('SMS: Supabase Auth could not be reached.', error);
    return json({ message: 'The server could not verify your login because Supabase Auth did not respond. Nothing was sent; try again in a moment.' }, 503);
  }
  if (!response.ok) {
    return json({ message: 'Your login session has expired. Sign out and sign in again to use SMS.' }, 401);
  }

  let user: { app_metadata?: Record<string, unknown> } | null = null;
  try {
    user = await response.json() as typeof user;
  } catch {
    /* handled by the claim check below */
  }
  if (user?.app_metadata?.main_madrasah_admin !== true) {
    return json({ message: 'This Supabase account is not authorized to send SMS. Set app_metadata "main_madrasah_admin": true for it in Supabase Auth.' }, 403);
  }
  return null;
}

async function callProvider(
  endpoint: string,
  parameters: URLSearchParams,
  method: 'GET' | 'POST',
): Promise<{ response: Response; body: ProviderResponse }> {
  const response = await fetch(`${SMS_API}${endpoint}${method === 'GET' ? `?${parameters}` : ''}`, {
    method,
    ...(method === 'POST' ? {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: parameters,
    } : {}),
    cache: 'no-store',
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  let body: ProviderResponse;
  try {
    body = await response.json() as ProviderResponse;
  } catch {
    throw new Error('SMS provider returned an unreadable response.');
  }
  return { response, body };
}

function providerMessage(code: number, fallback?: string): string {
  return PROVIDER_ERRORS[code] || fallback || `SMS provider request failed (error ${code}).`;
}

async function sendSms(request: Request): Promise<Response> {
  const config = getSmsConfig();
  if (!config) {
    return json({ message: 'SMS is not configured: add SMS_NET_BD_API_KEY to the server environment (the .env file locally, or the Vercel project settings) and restart/redeploy.' }, 503);
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ message: 'SMS request must be valid JSON.' }, 400);
  }
  const { recipients: rawRecipients, message } = (input && typeof input === 'object' ? input : {}) as { recipients?: unknown; message?: unknown };
  if (
    !Array.isArray(rawRecipients) || rawRecipients.length === 0 || rawRecipients.length > MAX_RECIPIENTS ||
    typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH
  ) {
    return json({ message: `Provide 1–${MAX_RECIPIENTS} recipients and a message under ${MAX_MESSAGE_LENGTH} characters.` }, 400);
  }

  const recipients = [...new Set(rawRecipients.map(formatBangladeshMobile).filter((number): number is string => number !== null))];
  if (recipients.length === 0) {
    return json({ message: 'No valid Bangladesh mobile numbers were provided.' }, 400);
  }
  if (recipients.length > 1 && !config.contentId) {
    return json({ message: 'Bulk SMS requires an approved content ID. Set SMS_NET_BD_CONTENT_ID on the server.' }, 503);
  }

  const parameters = new URLSearchParams({ api_key: config.apiKey, msg: message.trim(), to: recipients.join(',') });
  if (config.senderId) parameters.set('sender_id', config.senderId);
  if (recipients.length > 1 && config.contentId) parameters.set('content_id', config.contentId);

  try {
    const { response, body } = await callProvider('/sendsms', parameters, 'POST');
    if (!response.ok || Number(body.error) !== 0 || body.data?.request_id === undefined) {
      const code = Number(body.error);
      console.error('SMS provider rejected a send request', response.status, Number.isFinite(code) ? code : 'unknown');
      return json({ message: providerMessage(code, body.msg) }, 502);
    }
    return json({ requestId: body.data.request_id, recipientCount: recipients.length, message: body.msg || 'SMS request submitted.' });
  } catch (error) {
    // The provider may have accepted the message even though no answer arrived, so never auto-retry.
    console.error('SMS provider request failed.', error);
    return json({ message: 'The SMS provider did not confirm the request. Check the SMS.net.bd portal before sending again to avoid a duplicate.' }, 502);
  }
}

async function providerStatus(request: Request): Promise<Response> {
  const config = getSmsConfig();
  if (!config) {
    return json({ message: 'SMS is not configured: add SMS_NET_BD_API_KEY to the server environment (the .env file locally, or the Vercel project settings) and restart/redeploy.' }, 503);
  }

  const query = new URL(request.url).searchParams;
  const requestId = query.get('request_id');
  const endpoint = requestId
    ? (/^\d+$/.test(requestId) ? `/report/request/${requestId}/` : null)
    : query.get('operation') === 'balance' ? '/user/balance/' : null;
  if (!endpoint) {
    return json({ message: 'Choose operation=balance or provide a numeric request_id.' }, 400);
  }

  try {
    const { response, body } = await callProvider(endpoint, new URLSearchParams({ api_key: config.apiKey }), 'GET');
    if (!response.ok || Number(body.error) !== 0) {
      return json({ message: providerMessage(Number(body.error), body.msg) }, 502);
    }
    return json({ data: body.data ?? null });
  } catch (error) {
    console.error('SMS provider status request failed.', error);
    return json({ message: 'SMS provider status could not be loaded.' }, 502);
  }
}

export async function handleSmsRequest(request: Request): Promise<Response> {
  try {
    if (request.method !== 'POST' && request.method !== 'GET') {
      return json({ message: 'Method not allowed.' }, 405);
    }
    const denied = await rejectUnlessAdmin(request);
    if (denied) return denied;
    return request.method === 'POST' ? await sendSms(request) : await providerStatus(request);
  } catch (error) {
    console.error('SMS handler failed unexpectedly.', error);
    return json({ message: 'The SMS server hit an unexpected error. Nothing was confirmed as sent.' }, 500);
  }
}
