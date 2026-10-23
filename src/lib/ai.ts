// Thin client for the Groq OpenAI-compatible Chat Completions API.
// Credentials are read from Vite env vars (VITE_GROQ_*). Because this is a
// client-side SPA with no backend, the key is exposed to the browser — this is
// acceptable for a private, single-tenant school admin console. Do NOT reuse the
// key for any public-facing deployment without a server-side proxy.

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
}

export interface GroqToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface GroqTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ChatOptions {
  messages: GroqMessage[];
  tools?: GroqTool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  maxTokens?: number;
}

const API_KEY = import.meta.env.VITE_GROQ_API_KEY ?? '';
const BASE_URL = (import.meta.env.VITE_GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
const FALLBACK_MODEL = 'llama-3.1-8b-instant';
const configuredModel = import.meta.env.VITE_GROQ_MODEL?.trim();
const MODEL = configuredModel && configuredModel !== 'llama-3.3-70b-versatile'
  ? configuredModel
  : FALLBACK_MODEL;

export function isAiConfigured(): boolean {
  return Boolean(API_KEY && MODEL);
}

/**
 * Send a chat completion request to Groq. Returns the assistant message object
 * (which may contain `content`, `tool_calls`, or both).
 */
export async function groqChat(opts: ChatOptions): Promise<GroqMessage> {
  if (!API_KEY) {
    throw new Error('Groq API key is not configured. Add VITE_GROQ_API_KEY to your .env file.');
  }

  const body: Record<string, unknown> = {
    model: MODEL,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    stream: false,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.tools && opts.tools.length) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice ?? 'auto';
  }

  const request = (requestBody: Record<string, unknown>) => fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  let res = await request(body);
  if (res.status === 404 && body.model !== FALLBACK_MODEL) {
    body.model = FALLBACK_MODEL;
    res = await request(body);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      detail = await res.text().catch(() => '');
    }
    if (res.status === 401) {
      throw new Error('Groq authentication failed — check VITE_GROQ_API_KEY in .env.');
    }
    if (res.status === 429) {
      throw new Error('Groq rate limit reached. Please wait a moment and try again.');
    }
    throw new Error(`Groq API error ${res.status}: ${detail || res.statusText}`);
  }

  const json = await res.json();
  const choice = json?.choices?.[0];
  if (!choice) {
    throw new Error('Groq returned an empty response.');
  }
  const msg = choice.message as GroqMessage;
  return {
    role: 'assistant',
    content: msg.content ?? null,
    tool_calls: msg.tool_calls,
  };
}
