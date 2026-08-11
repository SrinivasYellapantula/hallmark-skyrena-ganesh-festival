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

test("registration validation supports voluntary donations while rejecting a zero-total record", async () => {
  const [route, form, constants, home, initialize, schema] = await Promise.all([
    source("app/api/registrations/route.ts"),
    source("app/contribute/ContributionForm.tsx"),
    source("app/lib/constants.ts"), source("app/page.tsx"),
    source("db/initialize.ts"), source("db/schema.ts"),
  ]);
  assert.match(route, /wholeNumber\(body\.get\("mainDonation"\), MINIMUM_DONATION\)/);
  assert.match(constants, /MINIMUM_DONATION = 0/);
  assert.match(form, /mainDonation: "0"/);
  assert.match(form, /Voluntary contribution/);
  assert.match(route, /mainDonation \+ idolDonation \+ annadaanamDonation <= 0/);
  assert.match(route, /at least one donation amount greater than ₹0/);
  assert.match(home, /Voluntary contribution · UPI only/);
  assert.doesNotMatch(home, /Minimum festival contribution/);
  assert.match(initialize, /donation_minimum INTEGER NOT NULL DEFAULT 0/);
  assert.match(schema, /donationMinimum: integer\("donation_minimum"\)\.notNull\(\)\.default\(0\)/);
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
  assert.match(form, /Mahaprasadam Donation Amount/);
  assert.match(form, /ATTENDANCE_OPTIONS/);
  assert.doesNotMatch(form, /publicNameConsent|Show resident name/);
});

test("idol donation is captured, editable, and included in every collection total", async () => {
  const [schema, form, createRoute, listRoute, detailRoute, donationScreen, publicRoute, publicScreen, summaryRoute, summaryScreen] = await Promise.all([
    source("db/schema.ts"), source("app/contribute/ContributionForm.tsx"),
    source("app/api/registrations/route.ts"), source("app/api/donations/route.ts"),
    source("app/api/donations/[id]/route.ts"), source("app/donations/DonationsDashboard.tsx"),
    source("app/api/public/summary/route.ts"), source("app/transparency/TransparencyDashboard.tsx"),
    source("app/api/collection-summary/route.ts"), source("app/collection-summary/CollectionSummary.tsx"),
  ]);
  assert.match(schema, /\["festival", "idol", "annadaanam"\]/);
  assert.match(form, /Idol Donation Amount/);
  assert.match(form, /idolDonation: "0"/);
  assert.match(form, /Number\(form\.idolDonation/);
  assert.match(createRoute, /wholeNumber\(body\.get\("idolDonation"\), 0\)/);
  assert.match(createRoute, /VALUES \(\?, \?, 'idol'/);
  assert.match(listRoute, /d\.category = 'idol'.*idolAmount/);
  assert.match(detailRoute, /body\.get\("idolDonation"\)/);
  assert.match(detailRoute, /category:"idol"/);
  assert.match(donationScreen, /<dt>Idol donation<\/dt>/);
  assert.match(donationScreen, /name="idolDonation"/);
  assert.match(publicRoute, /category = 'idol'.*idol/);
  assert.match(publicScreen, /Idol fund/);
  assert.match(summaryRoute, /idolCollection/);
  assert.match(summaryScreen, /<dt>Idol donation<\/dt>/);
});

test("donation form shows the official payment QR and Visarjan Mahaprasadam note", async () => {
  const [form, styles] = await Promise.all([
    source("app/contribute/ContributionForm.tsx"),
    source("app/globals.css"),
  ]);
  assert.match(form, /hallmark-skyrena-upi-qr\.png/);
  assert.match(form, /Lunch Mahaprasadam will be served on the day of Visarjan/);
  assert.match(form, /Tap to view full size/);
  assert.match(styles, /\.payment-qr-card/);
  assert.match(styles, /\.field-grid > \.wide \{ grid-column: 1 \/ -1; \}/);
  assert.match(styles, /max-width:360px/);
  assert.match(styles, /\.form-summary \{ position: static; grid-row: auto; \}/);
  assert.doesNotMatch(styles, /\.form-summary \{ position: static; grid-row: 1; \}/);
});

test("block users are scoped by the authenticated server identity", async () => {
  const [registration, flats] = await Promise.all([
    source("app/api/registrations/route.ts"),
    source("app/api/flats/route.ts"),
  ]);
  assert.match(registration, /user \? scopedBlock\(user/);
  assert.match(flats, /scopedBlock\(auth\.user/);
});

test("residents can use the donation form without exposing private flat-master details", async () => {
  const [gate, form, publicFlats, registration, page] = await Promise.all([
    source("app/components/AuthGate.tsx"), source("app/contribute/ContributionForm.tsx"),
    source("app/api/public/flats/route.ts"), source("app/api/registrations/route.ts"),
    source("app/contribute/page.tsx"),
  ]);
  assert.match(gate, /publicDonationForm/);
  assert.match(gate, /Submit a donation without signing in/);
  assert.match(form, /api\/public\/flats/);
  assert.match(form, /Existing household and donation details are never displayed publicly/);
  assert.match(publicFlats, /SELECT flat_no flatNo/);
  assert.doesNotMatch(publicFlats, /resident_name|occupancy|donat|visit_status|reference/i);
  assert.doesNotMatch(publicFlats, /authorize\(/);
  assert.match(registration, /getAppUser\(request\)/);
  assert.match(registration, /resident-self-service/);
  assert.doesNotMatch(registration, /const auth = await authorize\(request\)/);
  assert.match(page, /No login is required for residents/);
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

test("accidental deletions are protected by a Portal Admin recycle bin", async () => {
  const [recycleRoute, expenseRoute, meetingRoute, donationRoute, proofRoute, dashboard, donationsScreen, meetingsScreen, chrome, migration, resetRoute] = await Promise.all([
    source("app/api/admin/recycle-bin/route.ts"), source("app/api/admin/expenses/[id]/route.ts"),
    source("app/api/admin/meetings/route.ts"), source("app/api/donations/[id]/route.ts"), source("app/api/payment-proofs/[id]/route.ts"),
    source("app/admin/AdminDashboard.tsx"), source("app/donations/DonationsDashboard.tsx"),
    source("app/meetings/MeetingMinutes.tsx"), source("app/components/SiteChrome.tsx"),
    source("drizzle/0009_recycle_bin.sql"), source("app/api/admin/reset/route.ts"),
  ]);
  assert.match(recycleRoute, /isPortalOwner\(auth\.user\)/);
  assert.match(recycleRoute, /status='restored'/);
  assert.match(recycleRoute, /Number\(row\.ageDays\)<30/);
  assert.match(recycleRoute, /DELETE \$\{row\.entityLabel\}/);
  assert.match(recycleRoute, /permanently_deleted/);
  assert.match(expenseRoute, /UPDATE expenses SET status='reversed'/);
  assert.match(expenseRoute, /moved_to_recycle_bin/);
  assert.match(meetingRoute, /UPDATE meeting_minutes SET status='deleted'/);
  assert.doesNotMatch(meetingRoute, /DELETE FROM meeting_minutes/);
  assert.match(donationRoute, /export async function DELETE/);
  assert.match(donationRoute, /UPDATE registrations SET status='cancelled'/);
  assert.match(proofRoute, /row\.status==="cancelled"&&!isPortalOwner\(auth\.user\)/);
  assert.match(dashboard, /id="recycle-bin"/);
  assert.match(dashboard, /Delete in/);
  assert.match(donationsScreen, /Move Donation to Recycle Bin/);
  assert.match(meetingsScreen, /Move to Recycle Bin/);
  assert.match(chrome, /Restore removed records/);
  assert.match(migration, /CREATE TABLE `recycle_bin`/);
  assert.match(resetRoute, /DELETE FROM recycle_bin/);
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
  assert.match(dashboard, /Move to Recycle Bin/);
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
  assert.match(screen, /Move to Recycle Bin/);
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

test("role-scoped collection summary shows block and overall donation metrics", async () => {
  const [route, screen, page, chrome, styles] = await Promise.all([
    source("app/api/collection-summary/route.ts"),
    source("app/collection-summary/CollectionSummary.tsx"),
    source("app/collection-summary/page.tsx"),
    source("app/components/SiteChrome.tsx"),
    source("app/globals.css"),
  ]);
  assert.match(route, /authorize\(request, \["admin", "block"\]\)/);
  assert.match(route, /auth\.user\.role === "block"/);
  assert.match(route, /auth\.user\.blockNo/);
  assert.match(route, /donatedOccupiedFlats/);
  assert.match(route, /totalCollection/);
  assert.match(route, /verifiedCollection/);
  assert.match(route, /maximumDonation/);
  assert.match(route, /averageDonation/);
  assert.match(screen, /Blocks A–E/);
  assert.match(screen, /Overall Summary/);
  assert.match(screen, /Pending flats/);
  assert.match(screen, /Maximum flat donation/);
  assert.doesNotMatch(screen, /<select/);
  assert.match(page, /CollectionSummary/);
  assert.match(chrome, /href="\/collection-summary">Collection Summary/);
  assert.match(styles, /\.block-summary-grid/);
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
  assert.match(screen, /className="field-label">Occupancy <span className="optional">optional/);
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
