# Hallmark Skyrena Ganesh Chaturthi Community Ledger

A mobile-first community festival application designed for Cloudflare's no-card free allowances. D1 stores salted password hashes, expiring login sessions, records and role assignments, while a private Workers KV namespace stores compressed payment proofs.

## Included workflows

- Username/password login with PBKDF2 password hashing, failed-attempt throttling and HTTP-only session cookies
- Administrator and block-level roles, enforced again in every private API
- Administrator-managed user access, with block A–E assignment
- Block users restricted to their assigned block in both the interface and server APIs
- Household registration with block, flat, gotram, occupancy and Lunch Mahaprasadam attendance
- Main donation minimum and default of ₹2,000 plus optional Mahaprasadam contribution
- UPI-only payment references and private JPG, PNG or WebP proof uploads to Workers KV
- Automatic browser-side image compression to preserve the 1 GB KV free allowance
- Donation list, detailed view and authorized proof retrieval
- Block-scoped pending-flat and revisit queue
- Committee queue for payment verification or rejection
- Approved expense register with external receipt links
- Authorized block totals, attendee counts, consenting donor wall and available balance
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

1. Sign in to Wrangler with `npx wrangler login`.
2. Create the private proof namespace once with `npm run kv:create`, then copy the returned namespace ID into the `PAYMENT_PROOFS` entry in `wrangler.jsonc`. This repository is already configured with its production namespace ID.
3. Apply the D1 schema with `npm run db:migrate:remote`.
4. Deploy with `npm run deploy`, or connect this repository to Cloudflare Workers Builds using the same command.
5. Sign in with the initial administrator account, open **Users**, and immediately replace the temporary administrator password. Creating or resetting a user revokes that user's existing sessions.
6. Confirm each block account has its A–E assignment. An E-block user is locked to Block E by the server, even if a browser request is modified.
7. Add the official flat master list for blocks A–E as it becomes available. Until then, authorized users can add flats to each visit queue manually.
8. Test a real mobile camera upload, proof retrieval, block restriction, donation verification and UPI reconciliation before operational use.

The production Worker and D1 binding are defined in `wrangler.jsonc`. Dashboard-managed runtime variables are preserved across Wrangler deployments.

Do not expose KV through a public endpoint or publish D1 data directly. Payment proofs are streamed only after role and block authorization. The summary endpoint returns only verified aggregates and consented names, and is also behind application login.
