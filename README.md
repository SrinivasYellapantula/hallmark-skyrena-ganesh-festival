# Ganesh Festival Community Ledger

A mobile-first, zero-cost community festival application built for Cloudflare's free tier. It keeps household registration data private while publishing verified donation and expense totals.

## Included workflows

- Household registration with block, flat, gotram, occupancy and Annadaanam attendance
- Main donation minimum of ₹1,000 plus optional Annadaanam contribution
- UPI, bank-transfer and cash references
- Committee queue for payment verification or rejection
- Approved expense register with external receipt links
- Public block totals, attendee counts, consenting donor wall and available balance
- D1 audit records for submissions, verification and expenses
- Optional Cloudflare Turnstile spam protection

## Local development

```bash
npm install
npm run dev
```

The app is available at `http://localhost:3000`. Local D1 tables are initialized on first API request.

## Validation

```bash
npm run db:generate
npm test
npm run lint
```

Generated D1 migrations live in `drizzle/`.

## Before production deployment

1. Replace the sample block list in `app/lib/constants.ts` with the society's official block list.
2. Replace the committee contact address in `app/components/SiteChrome.tsx`.
3. Create a Cloudflare D1 database and bind it as `DB`.
4. Apply `drizzle/0000_acoustic_banshee.sql` and retain the runtime initializer as a safety net.
5. Configure `ADMIN_EMAILS` as a server-side environment value.
6. Protect `/admin*` and `/api/admin*` using Cloudflare Access with the same email allowlist.
7. Optionally configure both Turnstile keys from `.env.example`.
8. Test one real block, reconcile against the UPI/bank statement, then publish the QR code.

Do not publish D1 data directly. The `/api/public/summary` endpoint is deliberately restricted to verified aggregates and consented names.
