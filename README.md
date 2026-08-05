# Hallmark Skyrena Ganesh Chaturthi Community Ledger

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

## Cloudflare deployment

1. Confirm the official flat master list for blocks A–E.
2. Add the committee contact address in `app/components/SiteChrome.tsx`.
3. Sign in to Wrangler with `npx wrangler login`.
4. Apply the D1 schema with `npm run db:migrate:remote`.
5. Deploy once with `npm run deploy`, or connect this repository to Cloudflare Workers Builds using `npm run build` and `npx wrangler deploy`.
6. Configure `ADMIN_EMAILS` as a runtime variable in the Worker settings.
7. Protect `/admin*` and `/api/admin*` using Cloudflare Access with the same email allowlist.
8. Optionally configure both Turnstile keys from `.env.example`.
9. Test one real block, reconcile against the UPI/bank statement, then publish the QR code.

The production Worker and D1 binding are defined in `wrangler.jsonc`. Dashboard-managed runtime variables are preserved across Wrangler deployments.

Do not publish D1 data directly. The `/api/public/summary` endpoint is deliberately restricted to verified aggregates and consented names.
