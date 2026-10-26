# Samdania Talimul Islam Madrasah — School Management

React (Vite) school software with a Supabase data store. The public website lives in `main-madrasah/`.

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the values (Supabase, and the SMS settings below).
3. `npm run dev` — the app **and** its `/api/sms` endpoint run together on one port. No second server is needed.

Other commands: `npm run build`, `npm run lint` (type-check), `npm test`.

## Database

All data is stored in the Supabase table `kv_store` (create it with `SQLs/01_kv_store.sql`). The software loads everything from Supabase at start-up and refuses to save anything until that load has succeeded, so a bad connection can never overwrite real records with an empty list. A red banner appears while the database is unreachable and the software keeps retrying on its own.

## SMS (fee receipts, salary, absence and notices)

The browser calls this app's own `/api/sms`: `npm run dev` serves it locally and the `api/` folder serves it on Vercel. The SMS.net.bd key is read only on the server.

Set these as server environment variables — in `.env` locally and under **Vercel → Project → Settings → Environment Variables** for production, then restart / redeploy:

| Variable | Needed for |
| --- | --- |
| `SMS_NET_BD_API_KEY` | always |
| `SMS_NET_BD_SENDER_ID` | only if the provider approved a sender ID |
| `SMS_NET_BD_CONTENT_ID` | only when sending to more than one number (notices) |

Never add a `VITE_` prefix to these — `VITE_` values are copied into the public browser bundle.

Only a Supabase Auth user flagged as website admin may send SMS: create a user with the same email and password as the software login, and set its `app_metadata` to `{"main_madrasah_admin": true}`. The software signs into it silently when you log in. If SMS reports "not authorized" or "sign in again", this is the thing to check.

A fee, salary or absence SMS is sent after the record is saved. If the SMS fails, the record stays saved and a **Retry SMS** button appears; nothing is entered twice.
