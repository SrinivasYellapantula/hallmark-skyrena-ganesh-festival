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
  assert.doesNotMatch(route, /payment reference is required/i);
  assert.match(form, /UPI Transaction Reference No\. <span className="optional">optional<\/span>/);
  assert.match(route, /wholeNumber\(body\.get\("adultCount"\), 0, 7\)/);
  assert.match(route, /!phone/);
  assert.match(route, /PAYMENT_PROOFS/);
  assert.match(route, /KVNamespace/);
  assert.match(route, /occupied=1 LIMIT 1/);
  assert.match(form, /FLOOR_OPTIONS/);
  assert.match(form, /Select occupied flat/);
  assert.match(form, /flatFloor/);
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
  for (const file of files) assert.match(file, /isAdminRequest\(request\)|user\?\.role !== "admin"/);
});

test("payment verification supports proof review and recoverable corrections", async () => {
  const [adminRoute, dashboardRoute, dashboard, donationsRoute, donationDetail, donationsScreen, proofRoute] = await Promise.all([
    source("app/api/admin/donations/route.ts"), source("app/api/admin/dashboard/route.ts"),
    source("app/admin/AdminDashboard.tsx"), source("app/api/donations/route.ts"),
    source("app/api/donations/[id]/route.ts"), source("app/donations/DonationsDashboard.tsx"),
    source("app/api/payment-proofs/[id]/route.ts"),
  ]);
  assert.match(adminRoute, /request_correction/);
  assert.match(adminRoute, /correction_requested/);
  assert.doesNotMatch(adminRoute, /action === "verify" \? "verified" : "reversed"/);
  assert.match(adminRoute, /Enter what needs to be corrected/);
  assert.match(dashboardRoute, /hasProof/);
  assert.match(dashboardRoute, /json_extract\(a\.details, '\$\.reason'\)/);
  assert.match(dashboard, /View Payment Proof/);
  assert.match(dashboard, /Verify Payment/);
  assert.match(dashboard, /Send Back for Correction/);
  assert.match(donationsRoute, /correctionReason/);
  assert.match(donationDetail, /\["submitted","correction_requested"\]/);
  assert.match(donationDetail, /request\.formData\(\)/);
  assert.match(donationDetail, /payment_proof_key=\?/);
  assert.match(donationDetail, /resubmitted/);
  assert.match(donationsScreen, /Replace Payment Proof/);
  assert.match(donationsScreen, /Save & Resubmit for Verification/);
  assert.match(proofRoute, /auth\.user\.role === "block" && row\.blockNo !== auth\.user\.blockNo/);
});

test("portal owner can safely clear test data without removing access configuration", async () => {
  const [resetRoute, auth, dashboard, usersRoute, usersScreen] = await Promise.all([
    source("app/api/admin/reset/route.ts"), source("app/lib/auth.ts"),
    source("app/admin/AdminDashboard.tsx"), source("app/api/admin/users/route.ts"),
    source("app/admin/users/UserManagement.tsx"),
  ]);
  assert.match(auth, /user\?\.id === "initial-admin"/);
  assert.match(resetRoute, /isPortalOwner\(auth\.user\)/);
  assert.match(resetRoute, /RESET FESTIVAL DATA/);
  assert.match(resetRoute, /DELETE FROM donations/);
  assert.match(resetRoute, /DELETE FROM registrations/);
  assert.match(resetRoute, /DELETE FROM expenses/);
  assert.match(resetRoute, /DELETE FROM cultural_programmes/);
  assert.match(resetRoute, /DELETE FROM meeting_minutes/);
  assert.match(resetRoute, /expenses\/\$\{EVENT_ID\}\//);
  assert.match(resetRoute, /removeFlatMaster/);
  assert.doesNotMatch(resetRoute, /DELETE FROM app_users|DELETE FROM app_sessions/);
  assert.match(dashboard, /Clear Test Data/);
  assert.match(dashboard, /Also remove the occupied-flat master/);
  assert.match(usersRoute, /Only the Portal Admin can create or modify Admin accounts/);
  assert.match(usersRoute, /The Portal Admin account cannot be disabled/);
  assert.match(usersScreen, /initial-admin"\?"Portal Admin"/);
  assert.match(usersScreen, /<option value="admin">Admin<\/option>/);
  assert.match(usersScreen, /Protected/);
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
  assert.match(gate, /response\.text\(\)/);
  assert.match(gate, /empty response/);
  assert.match(login, /Login database initialization failed/);
  assert.match(migration, /CREATE TABLE `app_sessions`/);
  assert.match(seed, /initial-admin/);
  assert.doesNotMatch(seed, /nimda|skyrena@/);
  assert.match(compatibilityMigration, /sMd4jOhPD5gCJMMC4x13ItQ6\/NJwmwOOQuzSvLpKaeo=/);
  assert.doesNotMatch(compatibilityMigration, /nimda|skyrena@/);
});

test("role-specific workspaces are enforced and clearly named", async () => {
  const [auth, chrome, users, userRoute, culturalRoute, gate, migration] = await Promise.all([
    source("app/lib/auth.ts"), source("app/components/SiteChrome.tsx"),
    source("app/admin/users/UserManagement.tsx"), source("app/api/admin/users/route.ts"),
    source("app/api/cultural/programmes/route.ts"), source("app/components/AuthGate.tsx"),
    source("drizzle/0006_committee_workspaces.sql"),
  ]);
  assert.match(auth, /"cultural"/);
  assert.match(chrome, /Cultural Programme/);
  assert.match(chrome, /Festival Accounts/);
  assert.match(chrome, /Meeting Minutes/);
  assert.match(chrome, /Administration/);
  assert.match(chrome, /nav-toggle/);
  assert.match(chrome, /aria-expanded/);
  assert.match(chrome, /closeAdministrationMenu/);
  assert.match(chrome, /document\.addEventListener\("pointerdown"/);
  assert.match(chrome, /ref=\{adminMenuRef\}/);
  assert.match(users, /Block Coordinator/);
  assert.match(users, /Cultural Committee/);
  assert.match(userRoute, /"admin", "block", "cultural"/);
  assert.match(culturalRoute, /authorize\(request,\["admin","cultural"\]\)/);
  assert.match(gate, /user\.role === "cultural"/);
  assert.match(migration, /block_a_coordinator/);
});

test("meeting minutes support structured actions and PDF-ready printing", async () => {
  const [route, screen, migration, styles] = await Promise.all([
    source("app/api/admin/meetings/route.ts"), source("app/meetings/MeetingMinutes.tsx"),
    source("drizzle/0006_committee_workspaces.sql"), source("app/globals.css"),
  ]);
  assert.match(route, /authorize\(request, \["admin"\]\)/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /meeting_action_items/);
  assert.match(screen, /Action Items/);
  assert.match(screen, /Print \/ Save as PDF/);
  assert.match(screen, /Edit Minutes/);
  assert.match(screen, /Delete/);
  assert.match(migration, /CREATE TABLE `meeting_minutes`/);
  assert.match(styles, /@media print/);
});

test("mobile app metadata and compact controls are present", async () => {
  const [manifest, styles, pending, layout, chrome] = await Promise.all([
    source("app/manifest.ts"), source("app/globals.css"), source("app/pending/PendingFlats.tsx"), source("app/layout.tsx"), source("app/components/SiteChrome.tsx"),
  ]);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /skyrena-app-192\.png/);
  assert.match(manifest, /skyrena-app-512\.png/);
  assert.match(layout, /skyrena-favicon-32\.png/);
  assert.match(layout, /apple-touch-icon\.png/);
  assert.match(styles, /@media \(max-width: 480px\)/);
  assert.match(chrome, /className="admin-chevron"/);
  assert.match(styles, /\.admin-chevron\{/);
  assert.match(styles, /\.admin-menu\[open\] \.admin-chevron/);
  assert.match(styles, /\.block-filter\{width:140px/);
  assert.match(pending, /className="block-filter"/);
});

test("occupied-flat map and block-wise CSV import preserve collection history", async () => {
  const [mapRoute, flatsRoute, importRoute, screen, contribution, registration, chrome, migration, occupancyMigration] = await Promise.all([
    source("app/api/flats/map/route.ts"), source("app/api/flats/route.ts"),
    source("app/api/admin/flats/import/route.ts"), source("app/flat-status/FlatStatusMap.tsx"),
    source("app/contribute/ContributionForm.tsx"), source("app/api/registrations/route.ts"),
    source("app/components/SiteChrome.tsx"), source("drizzle/0007_occupied_flat_map.sql"),
    source("drizzle/0008_flat_occupancy.sql"),
  ]);
  assert.match(mapRoute, /f\.occupied=1/);
  assert.match(mapRoute, /donationAmount/);
  assert.match(importRoute, /authorize\(request, \["admin"\]\)/);
  assert.match(importRoute, /UPDATE flats SET occupied=0/);
  assert.match(importRoute, /visit history are preserved|ON CONFLICT/);
  assert.match(screen, /Upload Block/);
  assert.match(screen, /Download Template/);
  assert.match(screen, /Manage occupied-flat master/);
  assert.match(screen, /className="field-label">Resident Name/);
  assert.match(screen, /setMasterOccupancy/);
  assert.match(screen, /<dt>Occupancy<\/dt>/);
  assert.match(screen, /flat_no,resident_name,occupancy/);
  assert.match(screen, /Add \/ Update Flat/);
  assert.match(screen, /Remove Flat/);
  assert.match(screen, /groupFloors/);
  assert.match(screen, /startsWith\("G"\)\?"G"/);
  assert.match(screen, /floorOrder\(a\)-floorOrder\(b\)/);
  assert.match(screen, /Donation recorded/);
  assert.match(flatsRoute, /export async function DELETE/);
  assert.match(flatsRoute, /occupied=0/);
  assert.match(flatsRoute, /scopedBlock\(auth\.user/);
  assert.match(flatsRoute, /occupancy/);
  assert.match(importRoute, /flat\.occupancy/);
  assert.match(contribution, /occupancy: selectedFlat\?\.occupancy/);
  assert.match(registration, /occupancy=excluded\.occupancy/);
  assert.match(chrome, /\/flat-status/);
  assert.match(migration, /ADD `occupied`/);
  assert.match(occupancyMigration, /ADD `occupancy` text NOT NULL DEFAULT ''/);
});
