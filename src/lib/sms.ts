import { getAuthClient, hasWebsiteAdminAccess } from './auth';
import { loadSupabaseConfig } from './supabaseConfig';

// SMS goes through this app's own same-origin /api/sms endpoint (a Vercel Function in
// production, the Vite dev server locally). The SMS provider key never reaches the browser.
const SMS_ENDPOINT = '/api/sms';
const REQUEST_TIMEOUT_MS = 30_000;

export type SmsSubmission = {
  requestId: string | number;
  recipientCount: number;
  message: string;
};

export type SmsProviderStatus = {
  request_id?: string | number;
  request_status?: string;
  request_charge?: string;
  balance?: string;
  recipients?: Array<{ number: string; charge: string; status: string }>;
};

const NOT_ADMIN_MESSAGE = 'This Supabase account is not authorized to send SMS. Set app_metadata "main_madrasah_admin": true for it in Supabase Auth, then sign out and sign in again.';

async function getAdminAccessToken(forceRefresh: boolean): Promise<string> {
  await loadSupabaseConfig();
  const client = getAuthClient();

  const read = async () => forceRefresh ? client.auth.refreshSession() : client.auth.getSession();
  let { data, error } = await read();
  if (!error && data.session && !hasWebsiteAdminAccess(data.session)) {
    // The admin claim may have been granted after this session was issued.
    ({ data, error } = await client.auth.refreshSession());
  }
  if (error) {
    throw new Error(/fetch|network|timeout/i.test(error.message)
      ? 'Could not reach the login server (Supabase). Check the internet connection and try again.'
      : error.message);
  }
  if (!data.session?.access_token) {
    throw new Error('Sign out and sign in again to use SMS from the school software.');
  }
  if (!hasWebsiteAdminAccess(data.session)) throw new Error(NOT_ADMIN_MESSAGE);
  return data.session.access_token;
}

function describeNetworkFailure(error: unknown): string {
  if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return 'The SMS server did not answer in time. The message may or may not have been sent — check the SMS.net.bd portal before sending again.';
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'No internet connection. Reconnect and try again.';
  }
  return `Could not reach the SMS server (${SMS_ENDPOINT}). Make sure the software is running with its server part (npm run dev, or the Vercel deployment including the api folder) and try again.`;
}

async function requestSmsApi<T>(query: string, method: 'GET' | 'POST', payload?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const accessToken = await getAdminAccessToken(attempt > 0);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    let text: string;
    try {
      response = await fetch(`${SMS_ENDPOINT}${query}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal,
      });
      text = await response.text();
    } catch (error) {
      throw new Error(describeNetworkFailure(error));
    } finally {
      clearTimeout(timer);
    }

    // An expired token is rejected before anything is sent, so retrying once with a refreshed session cannot duplicate an SMS.
    if (response.status === 401 && attempt === 0) continue;

    let body: (Record<string, unknown> & { message?: string }) | null = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* not JSON — reported below */
    }
    if (!body || typeof body !== 'object') {
      throw new Error(response.status === 404 || response.ok
        ? `The SMS service was not found at ${SMS_ENDPOINT}. Deploy the api folder with the software (or run npm run dev) and try again.`
        : `The SMS server returned an unexpected response (HTTP ${response.status}). Try again in a moment.`);
    }
    if (!response.ok) throw new Error(body.message || `SMS request failed (HTTP ${response.status}).`);
    return body as T;
  }
  throw new Error('Your login session has expired. Sign out and sign in again to use SMS.');
}

export async function sendSchoolSms(recipients: string[], message: string): Promise<SmsSubmission> {
  const result = await requestSmsApi<Partial<SmsSubmission>>('', 'POST', { recipients, message });
  if (result.requestId === undefined || typeof result.recipientCount !== 'number') {
    throw new Error('The SMS provider response was incomplete. Check the SMS request report before retrying.');
  }
  return result as SmsSubmission;
}

export async function getSchoolSmsStatus(requestId?: string | number): Promise<SmsProviderStatus> {
  const query = requestId === undefined
    ? '?operation=balance'
    : `?request_id=${encodeURIComponent(String(requestId))}`;
  const result = await requestSmsApi<{ data?: SmsProviderStatus | null }>(query, 'GET');
  if (!result.data) throw new Error('The SMS provider returned no data for this request.');
  return result.data;
}

export const BENGALI_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];
