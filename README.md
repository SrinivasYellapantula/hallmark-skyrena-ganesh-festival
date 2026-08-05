# Hallmark Skyrena Ganesh Chaturthi Community Ledger

A mobile-first community festival application designed for Cloudflare's free allowances. Cloudflare Access handles passwordless login, D1 stores records and role assignments, and a private R2 bucket stores payment proofs.

## Included workflows

- Passwordless login through Cloudflare Access
- Administrator and block-level roles, enforced again in every private API
- Administrator-managed user access, with block A–E assignment
- Block users restricted to their assigned block in both the interface and server APIs
- Household registration with block, flat, gotram, occupancy and Annadaanam attendance
- Main donation minimum and default of ₹2,000 plus optional Annadaanam contribution
- UPI-only payment references and private JPG, PNG or WebP proof uploads to R2
- Donation list, detailed view and authorized proof retrieval
- Block-scoped pending-flat and revisit queue
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

1. Sign in to Wrangler with `npx wrangler login`.
2. Create the private proof bucket once with `npm run r2:create`.
3. Apply the D1 schema with `npm run db:migrate:remote`.
4. Configure `ADMIN_EMAILS` in the Worker settings as a comma-separated bootstrap-admin allowlist.
5. Deploy with `npm run deploy`, or connect this repository to Cloudflare Workers Builds using the same command.
6. In Cloudflare Zero Trust, create an Access self-hosted application for the complete Worker hostname (all paths). Enable email one-time PIN and use an **Allow / Everyone** policy so any email can complete authentication. This does not grant application access: the D1 user register still rejects every email that an administrator has not provisioned. Keeping authentication broad and authorization in D1 means users only need to be created once, from the app's **Users** screen.
7. Sign in as a bootstrap admin, open **Users**, and create each block user with an A–E assignment. An E-block user is locked to Block E by the server, even if a browser request is modified.
8. Add the official flat master list for blocks A–E as it becomes available. Until then, authorized users can add flats to each visit queue manually.
9. Test a real mobile camera upload, proof retrieval, block restriction, donation verification and UPI reconciliation before operational use.

The production Worker and D1 binding are defined in `wrangler.jsonc`. Dashboard-managed runtime variables are preserved across Wrangler deployments.

Do not make the R2 bucket public or publish D1 data directly. Payment proofs are streamed only after role and block authorization. The summary endpoint returns only verified aggregates and consented names, and is also behind application login.
