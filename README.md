# Desert Home Cleaning — Internal Work App

Private, installable work-board PWA for a small cleaning company. Owners post cleaning
blocks and employees can claim them. The first employee to accept a block gets it.

## Included

- Mobile-first employee job feed with pay, schedule, area, and work details
- Owner dashboard for creating and tracking work blocks
- First-accept-wins claim flow
- Installable PWA manifest and service worker
- Supabase schema with row-level security and atomic claiming
- Local demo mode for evaluating the product before Supabase is configured

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Use the role switcher to preview the owner and employee
experiences.

## Production setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor.
3. Copy `.env.example` to `.env.local` and add the project URL and publishable key.
4. Create the owner's account and set that profile's role to `owner`.
5. Invite employees and set their profiles to `employee`.
6. Deploy to an HTTPS host such as Vercel.

### Activate owner acceptance emails

The database queues an email to `raarentalsllc@gmail.com` whenever an employee successfully
claims work.

1. Create a Resend account, verify the sending domain, and create an API key.
2. Deploy `supabase/functions/send-claim-email`.
3. Set the Edge Function secrets `RESEND_API_KEY`, `CLAIM_EMAIL_FROM`, and
   `CLAIM_WEBHOOK_SECRET`.
4. In Supabase, create a Database Webhook for `INSERT` events on `public.email_outbox`.
5. Point it to the deployed `send-claim-email` function and add the header
   `Authorization: Bearer <the same CLAIM_WEBHOOK_SECRET>`.

The email function uses the outbox row ID as an idempotency key, preventing duplicate
emails if the webhook is retried.

The app currently uses local demo data while production authentication is connected.
Never put a Supabase service-role key in browser-visible environment variables.

## Security model

- Employees see only the general area before accepting.
- Exact addresses and access notes are unlocked for the assigned employee.
- Owner operations are protected by database row-level security, not just hidden UI.
- Claims use one atomic database function, preventing double assignment.
