# OTP email login

Login uses **app-managed OTP codes** sent through **Resend**. Supabase only creates the session after the code is verified. No magic links, no Supabase email hook required for login.

## Flow

1. User enters email on `/login`
2. App generates a 6-digit code, stores a hash in `wealth.login_otps`, sends email via Resend
3. User enters code on `/login/verify`
4. App verifies the code, then uses the Supabase **service role** to create a session
5. User is redirected to the client or advisor dashboard

## Required environment (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://mmubhwyxszonhnpyeosy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_key
SUPABASE_DB_PASSWORD=your_db_password
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

RESEND_API_KEY=re_...
RESEND_FROM_DOMAIN=no-reply.jagroup.co
```

Get the service role key from [Project Settings → API](https://supabase.com/dashboard/project/mmubhwyxszonhnpyeosy/settings/api). Server only, never expose to the browser.

## Database table

Run once in SQL Editor (or apply migration `20260828160400_create_login_otps.sql`):

```sql
CREATE TABLE IF NOT EXISTS wealth.login_otps (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Resend domain

Verify `no-reply.jagroup.co` in [Resend Domains](https://resend.com/domains). Once it shows Verified, any mailbox on it can send, and the app uses one per email type (see `lib/email/senders.ts`):

| Email | From |
| --- | --- |
| Sign-in codes | `JA Wealth <auth@no-reply.jagroup.co>` |
| Report ready | `JA Wealth Reports <reports@no-reply.jagroup.co>`, replies go to the client's wealth manager |
| Portfolio and account updates | `JA Wealth <updates@no-reply.jagroup.co>`, replies go to the client's wealth manager |
| Client and wealth manager invites | `JA Wealth <welcome@no-reply.jagroup.co>` |

Override any one with `RESEND_FROM_AUTH`, `RESEND_FROM_REPORTS`, `RESEND_FROM_UPDATES` or `RESEND_FROM_INVITES`. The Supabase `send-email` function reads the same `RESEND_FROM_DOMAIN` (or `RESEND_FROM_AUTH`), so set it in the function's secrets too.

## Rate limits (app-side)

- Minimum **60 seconds** between code requests per email
- Codes expire after **10 minutes**
- **5** wrong attempts per code, then request a new one

## Advisor test account

- Email: `tech@celerey.co` (advisor, linked to John Doe sample client)
- Client test: `john.doe@example.com`

## Optional: Supabase Auth hook

The route `/api/auth/hooks/send-email` and edge function `send-email` are **not used** for login anymore. You can ignore or remove the Send Email hook in the Supabase dashboard.
