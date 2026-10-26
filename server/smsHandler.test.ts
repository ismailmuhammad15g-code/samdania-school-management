import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleSmsRequest } from './smsHandler.js';

const realFetch = globalThis.fetch;
const SUPABASE = 'https://project.supabase.co';
const SECRET = 'super-secret-provider-key';

type Call = { url: string; init?: RequestInit };
let calls: Call[];
let supabaseReply: () => Response;
let providerReply: () => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
const adminUser = () => jsonResponse({ app_metadata: { main_madrasah_admin: true } });

beforeEach(() => {
  calls = [];
  process.env.SUPABASE_URL = SUPABASE;
  process.env.SUPABASE_ANON_KEY = 'anon';
  process.env.SMS_NET_BD_API_KEY = SECRET;
  delete process.env.SMS_NET_BD_SENDER_ID;
  delete process.env.SMS_NET_BD_CONTENT_ID;
  supabaseReply = adminUser;
  providerReply = () => jsonResponse({ error: 0, msg: 'Request successfully submitted', data: { request_id: 4242 } });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return url.startsWith(SUPABASE) ? supabaseReply() : providerReply();
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function post(body: unknown, token: string | null = 'token'): Request {
  return new Request('http://localhost/api/sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const get = (query: string) => new Request(`http://localhost/api/sms${query}`, { headers: { Authorization: 'Bearer token' } });
const providerCalls = () => calls.filter((call) => !call.url.startsWith(SUPABASE));

test('rejects requests without a login token and never contacts the provider', async () => {
  const res = await handleSmsRequest(post({ recipients: ['01712345678'], message: 'hi' }, null));
  assert.equal(res.status, 401);
  assert.equal(calls.length, 0);
});

test('reports an unreachable Supabase as 503 rather than a login failure', async () => {
  globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
  const res = await handleSmsRequest(post({ recipients: ['01712345678'], message: 'hi' }));
  assert.equal(res.status, 503);
  assert.match((await res.json() as { message: string }).message, /Nothing was sent/);
});

test('rejects an expired session and an account without the admin claim', async () => {
  supabaseReply = () => jsonResponse({ msg: 'invalid JWT' }, 401);
  assert.equal((await handleSmsRequest(post({ recipients: ['01712345678'], message: 'hi' }))).status, 401);

  supabaseReply = () => jsonResponse({ app_metadata: {} });
  assert.equal((await handleSmsRequest(post({ recipients: ['01712345678'], message: 'hi' }))).status, 403);
  assert.equal(providerCalls().length, 0);
});

test('explains a missing provider key', async () => {
  delete process.env.SMS_NET_BD_API_KEY;
  const res = await handleSmsRequest(post({ recipients: ['01712345678'], message: 'hi' }));
  assert.equal(res.status, 503);
  assert.match((await res.json() as { message: string }).message, /SMS_NET_BD_API_KEY/);
});

test('sends one SMS with a normalized number and never leaks the key', async () => {
  const res = await handleSmsRequest(post({ recipients: ['০১৭১২-৩৪৫৬৭৮'], message: '  Fee received  ' }));
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.deepEqual(JSON.parse(text), { requestId: 4242, recipientCount: 1, message: 'Request successfully submitted' });
  assert.ok(!text.includes(SECRET));

  assert.equal(providerCalls().length, 1);
  const sent = new URLSearchParams(String(providerCalls()[0].init?.body));
  assert.equal(sent.get('to'), '8801712345678');
  assert.equal(sent.get('msg'), 'Fee received');
  assert.equal(sent.get('api_key'), SECRET);
  assert.ok(providerCalls()[0].url.endsWith('/sendsms'));
});

test('rejects invalid input before contacting the provider', async () => {
  for (const body of [
    '{not json',
    {},
    { recipients: [], message: 'hi' },
    { recipients: ['01712345678'], message: '   ' },
    { recipients: ['01712345678'], message: 'x'.repeat(1001) },
    { recipients: ['12345', 'abc'], message: 'hi' },
  ]) {
    const res = await handleSmsRequest(post(body));
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.equal(providerCalls().length, 0);
});

test('bulk sending needs the approved content id and de-duplicates numbers', async () => {
  const bulk = { recipients: ['01712345678', '+8801712345678', '01812345678'], message: 'Notice' };
  assert.equal((await handleSmsRequest(post(bulk))).status, 503);
  assert.equal(providerCalls().length, 0);

  process.env.SMS_NET_BD_CONTENT_ID = 'campaign-1';
  const res = await handleSmsRequest(post(bulk));
  assert.equal(res.status, 200);
  assert.equal((await res.json() as { recipientCount: number }).recipientCount, 2);
  const sent = new URLSearchParams(String(providerCalls()[0].init?.body));
  assert.equal(sent.get('to'), '8801712345678,8801812345678');
  assert.equal(sent.get('content_id'), 'campaign-1');
});

test('turns provider failures into clear 502 messages', async () => {
  providerReply = () => jsonResponse({ error: 417, msg: 'raw' });
  const res = await handleSmsRequest(post({ recipients: ['01712345678'], message: 'hi' }));
  assert.equal(res.status, 502);
  assert.match((await res.json() as { message: string }).message, /insufficient balance/);

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).startsWith(SUPABASE)) return adminUser();
    throw new DOMException('timed out', 'TimeoutError');
  }) as typeof fetch;
  const timedOut = await handleSmsRequest(post({ recipients: ['01712345678'], message: 'hi' }));
  assert.equal(timedOut.status, 502);
  assert.match((await timedOut.json() as { message: string }).message, /before sending again/);
});

test('an unreadable provider answer is reported, not treated as success', async () => {
  providerReply = () => new Response('<html>gateway error</html>', { status: 200 });
  const res = await handleSmsRequest(post({ recipients: ['01712345678'], message: 'hi' }));
  assert.equal(res.status, 502);
});

test('balance and report lookups validate their parameters', async () => {
  providerReply = () => jsonResponse({ error: 0, data: { balance: '120.50' } });
  const balance = await handleSmsRequest(get('?operation=balance'));
  assert.deepEqual(await balance.json(), { data: { balance: '120.50' } });
  assert.match(providerCalls()[0].url, /\/user\/balance\/\?api_key=/);

  const report = await handleSmsRequest(get('?request_id=4242'));
  assert.equal(report.status, 200);
  assert.match(providerCalls()[1].url, /\/report\/request\/4242\//);

  assert.equal((await handleSmsRequest(get('?request_id=../../etc'))).status, 400);
  assert.equal((await handleSmsRequest(get(''))).status, 400);
});

test('only GET and POST are served', async () => {
  const res = await handleSmsRequest(new Request('http://localhost/api/sms', { method: 'DELETE' }));
  assert.equal(res.status, 405);
});
