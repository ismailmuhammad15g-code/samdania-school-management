import {
  adminDeniedResponse,
  adminPreflight,
  apiResponse,
  hasAdminAccess,
} from "@/lib/supabase-server";

const SMS_API = "https://api.sms.net.bd";
const MAX_RECIPIENTS = 1000;
const MAX_MESSAGE_LENGTH = 1000;

type SmsProviderResponse = {
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

function getSmsConfig() {
  const apiKey = process.env.SMS_NET_BD_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    senderId: process.env.SMS_NET_BD_SENDER_ID?.trim(),
    contentId: process.env.SMS_NET_BD_CONTENT_ID?.trim(),
  };
}

function normalizeRecipient(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  const digits = normalized.replace(/\D/g, "");
  if (/^01[3-9]\d{8}$/.test(digits)) return `880${digits.slice(1)}`;
  if (/^8801[3-9]\d{8}$/.test(digits)) return digits;
  return null;
}

async function providerRequest(
  endpoint: string,
  parameters: URLSearchParams,
  method: "GET" | "POST" = "POST",
): Promise<{ response: Response; body: SmsProviderResponse }> {
  const query = parameters.toString();
  const response = await fetch(
    `${SMS_API}${endpoint}${method === "GET" ? `?${query}` : ""}`,
    {
    method,
    ...(method === "POST" ? {
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: parameters,
    } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    },
  );
  let body: SmsProviderResponse;
  try {
    body = await response.json() as SmsProviderResponse;
  } catch {
    throw new Error("SMS provider returned an unreadable response.");
  }
  return { response, body };
}

function providerErrorMessage(code: number, fallback?: string) {
  const messages: Record<number, string> = {
    400: "SMS provider rejected a missing or invalid parameter.",
    403: "SMS provider denied this account's permission.",
    404: "SMS provider endpoint was not found.",
    405: "SMS provider requires authorization. Check the server API key.",
    409: "SMS provider reported an internal error.",
    410: "SMS account is expired.",
    411: "SMS reseller account is expired or suspended.",
    412: "SMS schedule is invalid.",
    413: "SMS sender ID is not approved.",
    414: "SMS message is empty.",
    415: "SMS message is too long.",
    416: "No valid Bangladesh phone number was found.",
    417: "SMS account has insufficient balance.",
    420: "SMS content was blocked by the provider.",
    421: "This account can send only to its registered number until the first balance recharge.",
  };
  return messages[code] || fallback || `SMS provider request failed (error ${code}).`;
}

export function OPTIONS() {
  return adminPreflight();
}

export async function POST(request: Request) {
  if (!(await hasAdminAccess(request))) return adminDeniedResponse();
  const config = getSmsConfig();
  if (!config) {
    return apiResponse({ message: "SMS is not configured. Set SMS_NET_BD_API_KEY on the website server." }, 503, true);
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return apiResponse({ message: "SMS request must be valid JSON." }, 400, true);
  }
  if (!input || typeof input !== "object" || !("recipients" in input) || !("message" in input)) {
    return apiResponse({ message: "SMS recipients and message are required." }, 400, true);
  }

  const body = input as { recipients: unknown; message: unknown };
  if (
    !Array.isArray(body.recipients) ||
    body.recipients.length === 0 ||
    body.recipients.length > MAX_RECIPIENTS ||
    typeof body.message !== "string" ||
    !body.message.trim() ||
    body.message.length > MAX_MESSAGE_LENGTH
  ) {
    return apiResponse({ message: `Provide 1–${MAX_RECIPIENTS} recipients and a message under ${MAX_MESSAGE_LENGTH} characters.` }, 400, true);
  }

  const recipients = [...new Set(body.recipients.map(normalizeRecipient).filter((number): number is string => number !== null))];
  if (recipients.length === 0) {
    return apiResponse({ message: "No valid Bangladesh mobile numbers were provided." }, 400, true);
  }
  if (recipients.length > 1 && !config.contentId) {
    return apiResponse({ message: "Bulk SMS requires an approved content ID. Set SMS_NET_BD_CONTENT_ID on the website server." }, 503, true);
  }

  const parameters = new URLSearchParams({
    api_key: config.apiKey,
    msg: body.message.trim(),
    to: recipients.join(","),
  });
  if (config.senderId) parameters.set("sender_id", config.senderId);
  if (recipients.length > 1 && config.contentId) parameters.set("content_id", config.contentId);

  try {
    const { response, body: result } = await providerRequest("/sendsms", parameters);
    if (!response.ok || Number(result.error) !== 0 || result.data?.request_id === undefined) {
      const code = Number(result.error);
      console.error("SMS provider rejected a send request with status/code", response.status, Number.isFinite(code) ? code : "unknown");
      return apiResponse({
        message: providerErrorMessage(code, result.msg),
      }, 502, true);
    }

    return apiResponse({
      requestId: result.data.request_id,
      recipientCount: recipients.length,
      message: result.msg || "SMS request submitted.",
    }, 200, true);
  } catch (error) {
    console.error("SMS provider request failed.", error);
    return apiResponse({ message: "The provider did not confirm the SMS request. Check the SMS.net.bd portal before retrying to avoid sending a duplicate." }, 502, true);
  }
}

export async function GET(request: Request) {
  if (!(await hasAdminAccess(request))) return adminDeniedResponse();
  const config = getSmsConfig();
  if (!config) {
    return apiResponse({ message: "SMS is not configured. Set SMS_NET_BD_API_KEY on the website server." }, 503, true);
  }

  const url = new URL(request.url);
  const requestId = url.searchParams.get("request_id");
  const operation = requestId ? "report" : url.searchParams.get("operation");
  const endpoint = operation === "report" && requestId && /^\d+$/.test(requestId)
    ? `/report/request/${encodeURIComponent(requestId)}/`
    : operation === "balance" && !requestId
      ? "/user/balance/"
      : null;
  if (!endpoint) {
    return apiResponse({ message: "Choose operation=balance or provide a numeric request_id." }, 400, true);
  }

  const parameters = new URLSearchParams({ api_key: config.apiKey });
  try {
    const { response, body } = await providerRequest(endpoint, parameters, "GET");
    if (!response.ok || Number(body.error) !== 0) {
      const code = Number(body.error);
      return apiResponse({ message: providerErrorMessage(code, body.msg) }, 502, true);
    }
    return apiResponse({ data: body.data ?? null }, 200, true);
  } catch (error) {
    console.error("SMS provider report request failed.", error);
    return apiResponse({ message: "SMS provider status could not be loaded." }, 502, true);
  }
}
