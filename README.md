# Steadfast & Co. Cleaning — Team App

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

## Four-account pilot setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor.
3. Copy `.env.example` to `.env.local` and add the Supabase project URL, publishable key,
   server URL, and service-role key.
4. Fill in two owner emails, two temporary employee emails, names, and a strong initial
   password in `.env.local`.
5. Run `npm run pilot:bootstrap`. It safely creates or updates exactly those four users.
6. Generate Web Push keys with `npx web-push generate-vapid-keys`, then add the public
   and private keys to `.env.local`. Set `VAPID_SUBJECT` to an owner email address.
7. Run `npm run dev`, sign in as each temporary employee, and tap **Enable notifications**.
8. Deploy to Vercel and copy the same production environment variables into the Vercel
   project. Keep `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, and the pilot password
   server-only.

The two employee accounts are test seats. They can be renamed later, or removed and
replaced when cleaners are hired. Do not reuse the initial pilot password for production.

If the Supabase project already contains the original `profiles` table with `admin` and
`cleaner` roles, run [`supabase/upgrade_legacy_schema.sql`](supabase/upgrade_legacy_schema.sql)
instead. It preserves those accounts and maps them to `owner` and `employee`.

## Pilot verification

- Sign in as both owners and confirm each can post work.
- Sign in on two employee phones and enable notifications.
- Post a test job and confirm both phones receive it.
- Accept simultaneously on both phones; only one employee should win.
- Confirm only the winning employee sees the address and access instructions.
- Remove the assignment from an owner account and confirm the job becomes available again.

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

The app uses local demo data only when Supabase environment variables are absent.
Never put a Supabase service-role key in browser-visible environment variables.

## Employee invitations

Owners can invite an employee from **Employees → Invite employee** using only a name and
email address. Before using invitations in production:

1. Run [`supabase/employee_invitation_upgrade.sql`](supabase/employee_invitation_upgrade.sql)
   once in the Supabase SQL Editor.
2. In Supabase, open **Authentication → Email Templates → Invite user**. Set the subject
   to the contents of [`supabase/email-templates/invite-subject.txt`](supabase/email-templates/invite-subject.txt)
   and the body to [`supabase/email-templates/invite.html`](supabase/email-templates/invite.html).
3. In Netlify, set `NEXT_PUBLIC_SITE_URL=https://steadfast-cleaning.netlify.app`,
   `SUPABASE_URL`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`, then redeploy.
4. Keep `https://steadfast-cleaning.netlify.app/**` in the Supabase authentication redirect allow list.

The iOS and Android email buttons use the same secure, single-use Supabase invitation.
After opening it, the employee creates a password, completes their profile, installs the
PWA using their browser, and enables notifications on that device.

## Security model

- Employees see only the general area before accepting.
- Exact addresses and access notes are unlocked for the assigned employee.
- Owner operations are protected by database row-level security, not just hidden UI.
- Claims use one atomic database function, preventing double assignment.
