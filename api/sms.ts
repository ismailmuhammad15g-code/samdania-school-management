// Vercel Function: same-origin SMS endpoint (POST /api/sms to send, GET /api/sms for balance/reports).
import { handleSmsRequest } from '../server/smsHandler.js';

export const GET = handleSmsRequest;
export const POST = handleSmsRequest;
