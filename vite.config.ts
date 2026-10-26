import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import { handleSmsRequest } from './server/smsHandler';

// Serves the same /api/sms handler that Vercel runs in production, so SMS works
// with just `npm run dev` (no second server). Server-only settings such as
// SMS_NET_BD_API_KEY are read from .env here and are never exposed to the browser bundle.
function smsApi(mode: string): Plugin {
  const serverEnv = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(serverEnv)) {
    if (/^(SMS_NET_BD_|SUPABASE_|VITE_SUPABASE_)/.test(key) && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  const middleware = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = Buffer.concat(chunks);

      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (value === undefined || ['host', 'connection', 'content-length', 'transfer-encoding'].includes(name)) continue;
        headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const method = req.method ?? 'GET';
      const request = new Request(`http://${req.headers.host ?? 'localhost'}${(req as { originalUrl?: string }).originalUrl ?? req.url}`, {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' || body.length === 0 ? undefined : body,
      });

      const response = await handleSmsRequest(request);
      res.statusCode = response.status;
      response.headers.forEach((value, name) => res.setHeader(name, value));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error('SMS dev endpoint failed.', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ message: 'The SMS dev endpoint hit an unexpected error. Nothing was confirmed as sent.' }));
    }
  };

  return {
    name: 'school-sms-api',
    configureServer(server) { server.middlewares.use('/api/sms', middleware); },
    configurePreviewServer(server) { server.middlewares.use('/api/sms', middleware); },
  };
}

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss(), smsApi(mode)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
