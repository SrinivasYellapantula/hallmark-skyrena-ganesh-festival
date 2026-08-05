import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("home page contains the core festival calls to action", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /Together, we make the celebration/);
  assert.match(page, /Record New Donation/);
  assert.match(page, /Capture details/);
  assert.doesNotMatch(page, />Contribute</);
  assert.match(page, /View live accounts/);
  assert.doesNotMatch(page, /codex-preview|react-loading-skeleton/i);
});

test("private data is not queried by the public summary endpoint", async () => {
  const route = await source("app/api/public/summary/route.ts");
  assert.match(route, /authorize\(request\)/);
  assert.match(route, /public_name_consent = 1/);
  assert.doesNotMatch(route, /gotram|phone|flat_no|occupancy/);
});

test("registration validation enforces the donation minimum", async () => {
  const [route, form] = await Promise.all([
    source("app/api/registrations/route.ts"),
    source("app/contribute/ContributionForm.tsx"),
  ]);
  assert.match(route, /wholeNumber\(body\.get\("mainDonation"\), MINIMUM_DONATION\)/);
  assert.match(route, /payment reference is required/i);
  assert.match(route, /wholeNumber\(body\.get\("adultCount"\), 0, 7\)/);
  assert.match(route, /!phone/);
  assert.match(route, /PAYMENT_PROOFS/);
  assert.match(route, /KVNamespace/);
  assert.doesNotMatch(route, /R2Bucket/);
  assert.match(form, /Lunch Mahaprasadam Attendance/);
  assert.match(form, /Other Donations Amount/);
  assert.match(form, /ATTENDANCE_OPTIONS/);
  assert.doesNotMatch(form, /publicNameConsent|Show resident name/);
});

test("block users are scoped by the authenticated server identity", async () => {
  const [registration, flats] = await Promise.all([
    source("app/api/registrations/route.ts"),
    source("app/api/flats/route.ts"),
  ]);
  assert.match(registration, /scopedBlock\(auth\.user/);
  assert.match(flats, /scopedBlock\(auth\.user/);
});

test("committee APIs enforce administrator access", async () => {
  const files = await Promise.all([
    source("app/api/admin/dashboard/route.ts"),
    source("app/api/admin/donations/route.ts"),
    source("app/api/admin/expenses/route.ts"),
  ]);
  for (const file of files) assert.match(file, /isAdminRequest\(request\)/);
});

test("expense register supports private receipt images and full administration", async () => {
  const [collectionRoute, detailRoute, receiptRoute, dashboard, chrome, categories, migration] = await Promise.all([
    source("app/api/admin/expenses/route.ts"),
    source("app/api/admin/expenses/[id]/route.ts"),
    source("app/api/admin/expense-receipts/[id]/route.ts"),
    source("app/admin/AdminDashboard.tsx"),
    source("app/components/SiteChrome.tsx"),
    source("app/lib/expense-categories.ts"),
    source("drizzle/0005_flawless_hawkeye.sql"),
  ]);
  assert.match(collectionRoute, /request\.formData\(\)/);
  assert.match(collectionRoute, /PAYMENT_PROOFS/);
  assert.match(detailRoute, /export async function PATCH/);
  assert.match(detailRoute, /export async function DELETE/);
  assert.match(receiptRoute, /private, no-store/);
  assert.match(dashboard, /capture="environment"/);
  assert.match(dashboard, /Recorded Expenses/);
  assert.match(dashboard, /Edit Expense/);
  assert.match(dashboard, /Delete Expense/);
  assert.match(dashboard, /Boolean\(selectedExpense\.hasReceipt\)/);
  assert.match(dashboard, /id="expenses"/);
  assert.match(dashboard, /payload\.expenses\[0\]/);
  assert.match(chrome, /\/admin#expenses/);
  assert.match(categories, /Sound & Lighting/);
  assert.match(categories, /Licences & Permissions/);
  assert.match(migration, /receipt_proof_key/);
});

test("application login uses hashed passwords and server-side sessions", async () => {
  const [login, passwords, auth, gate, migration, seed, compatibilityMigration] = await Promise.all([
    source("app/api/auth/login/route.ts"),
    source("app/lib/passwords.ts"),
    source("app/lib/auth.ts"),
    source("app/components/AuthGate.tsx"),
    source("drizzle/0002_cheerful_marauders.sql"),
    source("drizzle/0003_seed_initial_users.sql"),
    source("drizzle/0004_cloudflare_pbkdf2_limit.sql"),
  ]);
  assert.match(passwords, /pbkdf2\(/);
  assert.match(passwords, /timingSafeEqual/);
  assert.match(passwords, /100_000/);
  assert.match(login, /login_attempts/);
  assert.match(auth, /HttpOnly; SameSite=Strict/);
  assert.match(auth, /app_sessions/);
  assert.match(gate, /Sign in/);
  assert.match(migration, /CREATE TABLE `app_sessions`/);
  assert.match(seed, /initial-admin/);
  assert.doesNotMatch(seed, /nimda|skyrena@/);
  assert.match(compatibilityMigration, /sMd4jOhPD5gCJMMC4x13ItQ6\/NJwmwOOQuzSvLpKaeo=/);
  assert.doesNotMatch(compatibilityMigration, /nimda|skyrena@/);
});
