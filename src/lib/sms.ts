import { getAuthClient } from './auth';

export function getMainMadrasahApiUrl(): string {
  const configuredUrl = import.meta.env.VITE_MAIN_MADRASAH_API_URL?.trim();
  if (configuredUrl) {
    try {
      const parsedUrl = new URL(configuredUrl);
      const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, '').toLowerCase();
      const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' ||
        hostname === '::1' || hostname.endsWith('.localhost');
      if (import.meta.env.PROD && (isLocalHost || parsedUrl.protocol !== 'https:')) return '';
    } catch {
      return '';
    }
    return configuredUrl;
  }
  return import.meta.env.DEV ? 'http://localhost:3018' : '';
}

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

async function getAdminAccessToken(): Promise<string> {
  const { data, error } = await getAuthClient().auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) {
    throw new Error('Sign in again to use SMS from the school software.');
  }
  return data.session.access_token;
}

async function fetchSmsApi(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    throw new Error('Could not reach the website SMS API. Check VITE_MAIN_MADRASAH_API_URL, confirm the website API is online, and rebuild/redeploy the school software.');
  }
}

export async function sendSchoolSms(
  apiUrl: string,
  recipients: string[],
  message: string,
): Promise<SmsSubmission> {
  const base = apiUrl.trim().replace(/\/+$/, '');
  if (!base) {
    throw new Error('SMS is not configured: set VITE_MAIN_MADRASAH_API_URL to the deployed website HTTPS address, then rebuild and redeploy the school software.');
  }

  const accessToken = await getAdminAccessToken();

  const response = await fetchSmsApi(`${base}/api/admin/sms`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipients, message }),
    cache: 'no-store',
  });

  const result = await response.json() as Partial<SmsSubmission> & { error?: number; msg?: string };
  if (!response.ok) {
    throw new Error(result.message || result.msg || `SMS request failed (${response.status}).`);
  }
  if (result.requestId === undefined || typeof result.recipientCount !== 'number') {
    throw new Error('The SMS provider response was incomplete. Check the SMS request report before retrying.');
  }

  return result as SmsSubmission;
}

export async function getSchoolSmsStatus(
  apiUrl: string,
  requestId?: string | number,
): Promise<SmsProviderStatus> {
  const base = apiUrl.trim().replace(/\/+$/, '');
  if (!base) {
    throw new Error('SMS is not configured: set VITE_MAIN_MADRASAH_API_URL to the deployed website HTTPS address, then rebuild and redeploy the school software.');
  }
  const accessToken = await getAdminAccessToken();
  const query = requestId === undefined
    ? '?operation=balance'
    : `?request_id=${encodeURIComponent(String(requestId))}`;
  const response = await fetchSmsApi(`${base}/api/admin/sms${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const result = await response.json() as { message?: string; data?: SmsProviderStatus | null };
  if (!response.ok || !result.data) {
    throw new Error(result.message || `SMS status request failed (${response.status}).`);
  }
  return result.data;
}

export function formatBangladeshMobile(value: string): string | null {
  const normalized = value.replace(/[০-৯]/g, (digit) => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  const digits = normalized.replace(/[^\d]/g, '');
  if (/^01[3-9]\d{8}$/.test(digits)) return `880${digits.slice(1)}`;
  if (/^8801[3-9]\d{8}$/.test(digits)) return digits;
  return null;
}

export const BENGALI_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];
