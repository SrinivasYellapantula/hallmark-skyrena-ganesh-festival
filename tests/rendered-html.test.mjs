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
  assert.match(form, /clearDefaultAmount/);
  assert.match(form, /restoreEmptyAmount/);
  assert.match(form, /onFocus=\{\(\) => clearDefaultAmount\("mainDonation"\)\}/);
  assert.match(form, /onFocus=\{\(\) => clearDefaultAmount\("idolDonation"\)\}/);
  assert.match(form, /onFocus=\{\(\) => clearDefaultAmount\("annadaanamDonation"\)\}/);
  assert.match(form, /Voluntary contribution/);
  assert.match(route, /mainDonation \+ idolDonation \+ annadaanamDonation <= 0/);
  assert.match(route, /at least one donation amount greater than ₹0/);
  assert.match(home, /Voluntary contribution · UPI, IMPS or NEFT/);
  assert.doesNotMatch(home, /Minimum festival contribution/);
  assert.match(initialize, /donation_minimum INTEGER NOT NULL DEFAULT 0/);
  assert.match(schema, /donationMinimum: integer\("donation_minimum"\)\.notNull\(\)\.default\(0\)/);
  assert.doesNotMatch(route, /payment reference is required/i);
  assert.match(form, /isResident \? "Transaction Reference No\." : "UPI Transaction Reference No\."/);
  assert.match(route, /wholeNumber\(body\.get\("adultCount"\), 0, 7\)/);
  assert.match(route, /\^\\d\{10\}\$\/\.test\(phone\)/);
  assert.match(form, /className="phone-prefix" aria-hidden="true">\+91/);
  assert.match(form, /inputMode="numeric"/);
  assert.match(form, /minLength=\{10\} maxLength=\{10\} pattern="\[0-9\]\{10\}"/);
  assert.match(form, /replace\(\/\\D\/g, ""\)\.slice\(0, 10\)/);
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
  assert.match(form, /isResident && <p className="mahaprasadam-note"><strong>Daily prasadam:<\/strong> Daily prasadam will be served in the evening after pooja/);
  assert.match(form, /distribution will be subject to availability/);
  assert.match(form, /Tap to view full size/);
  assert.match(form, /Take Photo/);
  assert.match(form, /Choose from Gallery/);
  assert.match(form, /capture="environment"/);
  assert.match(form, /aria-label="Choose a payment confirmation image from gallery" type="file" accept="image\/jpeg,image\/png,image\/webp" onChange/);
  assert.match(styles, /\.payment-qr-card/);
  assert.match(styles, /\.field-grid > \.wide \{ grid-column: 1 \/ -1; \}/);
  assert.match(styles, /max-width:360px/);
  assert.match(styles, /\.form-summary \{ position: static; grid-row: auto; \}/);
  assert.doesNotMatch(styles, /\.form-summary \{ position: static; grid-row: 1; \}/);
});

test("resident donation form uses platform-safe UPI links without changing manual verification", async () => {
  const [form, styles] = await Promise.all([
    source("app/contribute/ContributionForm.tsx"),
    source("app/globals.css"),
  ]);
  assert.match(form, /FESTIVAL_UPI_ID/);
  assert.match(form, /MSHALLMARKSKYRENAFLATOWNERSMAINTENANCEMACSOCIETYLTDCULTURAL\.eazypay@icici/);
  assert.match(form, /new URLSearchParams/);
  assert.match(form, /FESTIVAL_UPI_TRANSACTION_REFERENCE = "EZYS9182205699"/);
  assert.match(form, /FESTIVAL_UPI_NAME = "M\/S\.HALLMARK SKYRENA FLAT OWNERS MAINTENANCE MAC SOCIETY LTD -CULTURAL"/);
  assert.match(form, /tr: FESTIVAL_UPI_TRANSACTION_REFERENCE/);
  assert.match(form, /mc: FESTIVAL_UPI_MERCHANT_CATEGORY/);
  assert.doesNotMatch(form, /HS26\$\{Date\.now/);
  assert.match(form, /am: total\.toFixed\(2\)/);
  assert.match(form, /return `\$\{isIOS \? "gpay:\/\/upi\/pay" : "upi:\/\/pay"\}\?/);
  assert.match(form, /<a href=\{upiIntentUrl\} className="button primary full upi-intent-button" onClick=\{validateUpiLink\}>/);
  assert.match(form, /event\.preventDefault\(\)/);
  assert.doesNotMatch(form, /window\.location\.assign/);
  assert.match(form, /iPad\|iPhone\|iPod/);
  assert.match(form, /navigator\.platform === "MacIntel" && navigator\.maxTouchPoints > 1/);
  assert.match(form, /isResident && <div className="upi-intent-panel">/);
  assert.match(form, /Pay \$\{currency\(total\)\} using any UPI app/);
  assert.match(form, /Pay \$\{currency\(total\)\} with Google Pay/);
  assert.match(form, /On iPhone, this button opens Google Pay directly/);
  assert.match(form, /To pay with PhonePe or another UPI app, use the QR code shown here/);
  assert.match(form, /recipient name contains <strong>Hallmark Skyrena<\/strong> and <strong>Cultural<\/strong>/);
  assert.match(form, /Never share your UPI PIN or OTP/);
  assert.match(form, /Please use a linked bank account\. RuPay credit-card payments may not be supported for this merchant/);
  assert.match(form, /navigator\.clipboard\.writeText\(FESTIVAL_UPI_ID\)/);
  assert.match(form, /UPI ID Copied ✓/);
  assert.match(form, /Copy UPI ID/);
  assert.match(styles, /\.upi-intent-panel/);
  assert.match(styles, /\.upi-copy-row/);
  assert.match(styles, /\.upi-payment-note/);
  assert.match(styles, /\.upi-intent-button/);
  assert.match(form, /Payment Confirmation Image/);
});

test("resident payment is the final gated step while committee entry remains unchanged", async () => {
  const [form, styles] = await Promise.all([
    source("app/contribute/ContributionForm.tsx"),
    source("app/globals.css"),
  ]);
  assert.match(form, /residentPaymentReady = Boolean/);
  assert.match(form, /new RegExp\(`\^\(\?:\$\{canonicalFlatPattern\(form\.blockNo\)\}\)\$`/);
  assert.ok(form.includes("/^\\d{10}$/.test(form.phone)"));
  assert.match(form, /&& total > 0/);
  assert.match(form, /Payment &amp; Confirmation/);
  assert.ok(form.indexOf("Lunch Mahaprasadam Attendance") < form.indexOf("Payment &amp; Confirmation"));
  assert.match(form, /!isResident && paymentFields/);
  assert.match(form, /Complete the required details to view payment options/);
  assert.match(form, /After making the payment:/);
  assert.match(form, /Submit Donation/);
  assert.match(form, /RESIDENT_DRAFT_KEY/);
  assert.match(form, /window\.localStorage\.setItem\(RESIDENT_DRAFT_KEY/);
  assert.match(form, /window\.localStorage\.removeItem\(RESIDENT_DRAFT_KEY\)/);
  assert.match(styles, /\.payment-locked/);
  assert.match(styles, /\.payment-return-reminder/);
  assert.match(styles, /\.resident-submit/);
});

test("gotram is optional for resident and committee donation entry", async () => {
  const [form, registration, donations] = await Promise.all([
    source("app/contribute/ContributionForm.tsx"),
    source("app/api/registrations/route.ts"),
    source("app/donations/DonationsDashboard.tsx"),
  ]);
  assert.match(form, /Gotram<span className="optional">optional<\/span>/);
  assert.match(form, /<input name="gotram"/);
  assert.doesNotMatch(form, /<input required name="gotram"/);
  assert.doesNotMatch(registration, /!gotram/);
  assert.doesNotMatch(registration, /gotram and phone number are required/);
  assert.match(donations, /selected\.gotram \|\| "Not recorded"/);
});

test("occupancy is optional for resident and committee donation entry", async () => {
  const [form, registration] = await Promise.all([
    source("app/contribute/ContributionForm.tsx"),
    source("app/api/registrations/route.ts"),
  ]);
  assert.match(form, /Occupancy<span className="optional">optional<\/span>/);
  assert.match(form, /<select name="occupancy"/);
  assert.doesNotMatch(form, /<select required=\{!isResident\} name="occupancy"/);
  assert.match(registration, /if \(occupancy && !\['owner', 'tenant'\]\.includes\(occupancy\)\)/);
  assert.doesNotMatch(registration, /user && !\['owner', 'tenant'\]\.includes\(occupancy\)/);
});

test("block users are scoped by the authenticated server identity", async () => {
  const [registration, flats] = await Promise.all([
    source("app/api/registrations/route.ts"),
    source("app/api/flats/route.ts"),
  ]);
  assert.match(registration, /user \? scopedBlock\(user/);
  assert.match(flats, /scopedBlock\(auth\.user/);
});

test("residents can use an unrestricted flat field without changing the volunteer form", async () => {
  const [gate, form, registration, page] = await Promise.all([
    source("app/components/AuthGate.tsx"), source("app/contribute/ContributionForm.tsx"),
    source("app/api/registrations/route.ts"), source("app/contribute/page.tsx"),
  ]);
  assert.match(gate, /publicDonationForm/);
  assert.match(gate, /Submit a donation without signing in/);
  assert.doesNotMatch(form, /api\/public\/flats/);
  assert.match(form, /Flat Number<span className="required-mark">\*<\/span>/);
  assert.match(form, /input required name="flatNo"/);
  assert.match(form, /isResident \? "Pay using UPI, IMPS or NEFT\."/);
  assert.match(form, /api\/flats\/map/);
  assert.match(form, /Select occupied flat/);
  assert.match(registration, /getAppUser\(request\)/);
  assert.match(registration, /resident-self-service/);
  assert.match(registration, /if \(user\) \{/);
  assert.match(registration, /occupancy && !\['owner', 'tenant'\]\.includes\(occupancy\)/);
  assert.match(registration, /excluded\.occupancy<>'' THEN excluded\.occupancy ELSE flats\.occupancy/);
  assert.doesNotMatch(registration, /const auth = await authorize\(request\)/);
  assert.match(page, /No login is required for residents/);
  assert.doesNotMatch(await source("app/components/SiteChrome.tsx"), /Committee sign in|committee-signin/);
});

test("resident donations support reconciliable UPI, IMPS and NEFT payments", async () => {
  const [form, registration, schema, styles] = await Promise.all([
    source("app/contribute/ContributionForm.tsx"),
    source("app/api/registrations/route.ts"),
    source("db/schema.ts"),
    source("app/globals.css"),
  ]);
  assert.match(form, /FESTIVAL_BANK_ACCOUNT = "576905000064"/);
  assert.match(form, /FESTIVAL_BANK_IFSC = "ICIC0005769"/);
  assert.match(form, /FESTIVAL_BANK_HOLDER = "HALLMARK SKYRENA FLAT OWNERS MAINTENANCE MAC SOCIETY LTD - CULTURAL"/);
  assert.match(form, /name="paymentMethod"/);
  assert.match(form, /<option value="upi">UPI<\/option>/);
  assert.match(form, /<option value="imps">IMPS bank transfer<\/option>/);
  assert.match(form, /<option value="neft">NEFT bank transfer<\/option>/);
  assert.match(form, /Copy Bank Details/);
  assert.match(form, /navigator\.clipboard\.writeText\(details\)/);
  assert.match(form, /Transaction Reference No\./);
  assert.match(registration, /\["upi", "imps", "neft"\]\.includes\(paymentMethod\)/);
  assert.match(registration, /mainDonation, paymentMethod, paymentReference/);
  assert.match(registration, /annadaanamDonation, paymentMethod, paymentReference/);
  assert.match(registration, /idolDonation, paymentMethod, paymentReference/);
  assert.match(schema, /"bank_transfer", "imps", "neft"/);
  assert.match(styles, /\.bank-transfer-card/);
});

test("successful donations notify the portal admin through optional failure-safe Telegram secrets", async () => {
  const [route, telegram] = await Promise.all([
    source("app/api/registrations/route.ts"), source("app/lib/telegram.ts"),
  ]);
  assert.match(route, /await d1\.batch\(statements\);/);
  assert.match(route, /await notifyPortalAdminOfDonation/);
  assert.match(route, /Telegram donation notification failed/);
  assert.match(telegram, /TELEGRAM_BOT_TOKEN/);
  assert.match(telegram, /TELEGRAM_CHAT_ID/);
  assert.match(telegram, /api\.telegram\.org\/bot\$\{token\}\/sendMessage/);
  assert.match(telegram, /AbortSignal\.timeout\(5000\)/);
  assert.doesNotMatch(telegram, /residentName|phone|paymentReference|paymentProof/);
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
  assert.match(dashboard, /Request Correction/);
  assert.match(dashboard, /Request a correction/);
  assert.doesNotMatch(dashboard, /Send Back|Send back/);
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
  const [recycleRoute, expenseRoute, meetingRoute, donationRoute, proofRoute, dashboard, donationsScreen, meetingsScreen, chrome, migration] = await Promise.all([
    source("app/api/admin/recycle-bin/route.ts"), source("app/api/admin/expenses/[id]/route.ts"),
    source("app/api/admin/meetings/route.ts"), source("app/api/donations/[id]/route.ts"), source("app/api/payment-proofs/[id]/route.ts"),
    source("app/admin/AdminDashboard.tsx"), source("app/donations/DonationsDashboard.tsx"),
    source("app/meetings/MeetingMinutes.tsx"), source("app/components/SiteChrome.tsx"),
    source("drizzle/0009_recycle_bin.sql"),
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
});

test("portal-wide test-data clearing is unavailable while Portal Admin access remains protected", async () => {
  const [auth, dashboard, usersRoute, usersScreen] = await Promise.all([
    source("app/lib/auth.ts"), source("app/admin/AdminDashboard.tsx"), source("app/api/admin/users/route.ts"),
    source("app/admin/users/UserManagement.tsx"),
  ]);
  assert.match(auth, /user\?\.id === "initial-admin"/);
  assert.doesNotMatch(dashboard, /Clear Test Data|Test-data reset|api\/admin\/reset|ResetPortalDialog/);
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
  assert.match(styles, /@media \(max-width: 1500px\)/);
  assert.match(styles, /\.brand-copy \{[^}]*white-space: nowrap/);
  assert.match(styles, /\.nav-wrap \{[^}]*width: min\(1500px, calc\(100% - 40px\)\)/);
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
  assert.match(route, /optedOutFlats/);
  assert.match(route, /f\.visit_status='opted_out'/);
  assert.match(route, /competitionBlocks/);
  assert.match(route, /competitionBlocks\.filter\(\(block\) => block\.blockNo === auth\.user\.blockNo\)/);
  assert.match(route, /occupied_flat_keys AS/);
  assert.match(route, /donated_flat_keys AS/);
  assert.match(route, /SUBSTR\(REPLACE\(REPLACE\(UPPER\(TRIM\(r\.flat_no\)\)/);
  assert.match(route, /d\.flatNo=o\.flatNo/);
  assert.match(route, /flat_totals AS/);
  assert.match(route, /FROM registration_totals GROUP BY blockNo,flatNo/);
  assert.match(route, /COALESCE\(MAX\(totalCollection\),0\) maximumDonation/);
  assert.match(route, /COALESCE\(ROUND\(AVG\(totalCollection\)\),0\) averageDonation/);
  assert.match(screen, /Blocks A–E/);
  assert.match(screen, /Overall Summary/);
  assert.ok(screen.indexOf("Overall Summary") < screen.indexOf("Blocks A–E"));
  assert.match(screen, /Door-to-door pending/);
  assert.match(screen, /Opted out/);
  assert.match(screen, /Maximum flat donation/);
  assert.match(screen, /Participation Leaderboard/);
  assert.match(screen, /Ranked by the percentage of occupied flats/);
  assert.match(screen, /Collection Split by Block/);
  assert.match(screen, /Highest participation/);
  assert.match(screen, /Highest collection/);
  assert.match(screen, /Best average per donating flat/);
  assert.ok(screen.indexOf("Total donating flats") < screen.indexOf("Main festival donation"));
  assert.ok(screen.indexOf("Main festival donation") < screen.indexOf("Donating flats outside occupied master"));
  assert.ok(screen.indexOf("Average per donated flat") < screen.indexOf("Additional Mahaprasadam support"));
  assert.ok(screen.indexOf("Verified collection") < screen.indexOf("Maximum flat donation"));
  assert.doesNotMatch(screen, /<select/);
  assert.match(page, /CollectionSummary/);
  assert.match(chrome, /href="\/collection-summary">Collection Summary/);
  assert.match(styles, /\.block-summary-grid/);
  assert.match(styles, /\.challenge-leaderboard/);
  assert.match(styles, /\.challenge-stack-fill/);
  assert.match(styles, /\/\* Readable statistical numerals \*\//);
  assert.match(styles, /font-variant-numeric:tabular-nums/);
});

test("volunteers can exclude opted-out flats from the door-to-door queue and restore them", async () => {
  const [route, pending, map, styles] = await Promise.all([
    source("app/api/flats/route.ts"),
    source("app/pending/PendingFlats.tsx"),
    source("app/flat-status/FlatStatusMap.tsx"),
    source("app/globals.css"),
  ]);
  assert.match(route, /'opted_out'/);
  assert.match(route, /\["pending","visited","visit_again","opted_out"\]/);
  assert.match(pending, /Mark opted out/);
  assert.match(pending, /Return to pending/);
  assert.match(pending, /Door-to-door pending/);
  assert.match(pending, /Opted-out flats/);
  assert.match(map, /optedOutCount/);
  assert.match(map, /Opted out · do not visit/);
  assert.match(styles, /\.flat-tile\.opted-out/);
  assert.match(styles, /\.visit-queue-summary/);
});

test("flat numbers are canonicalized so block-prefixed repeat donations count once", async () => {
  const [server, registration, summary, donationDetail, donationsScreen, contribution] = await Promise.all([
    source("app/lib/server.ts"),
    source("app/api/registrations/route.ts"),
    source("app/api/collection-summary/route.ts"),
    source("app/api/donations/[id]/route.ts"),
    source("app/donations/DonationsDashboard.tsx"),
    source("app/contribute/ContributionForm.tsx"),
  ]);
  assert.match(server, /export function normalizeFlatNo/);
  assert.match(server, /flat\.startsWith\(block\)/);
  assert.match(server, /\^\(\?:G\|\\d\)/);
  assert.match(server, /export function isValidFlatNo/);
  assert.match(server, /isFlatNumberAllowed\(flat, block\)/);
  assert.match(registration, /normalizeFlatNo\(body\.get\("flatNo"\), blockNo\)/);
  assert.match(registration, /!isValidFlatNo\(flatNo, blockNo\)/);
  assert.match(registration, /flat sequence.*01–06.*01–10/);
  assert.match(contribution, /pattern=\{flatPattern\(form\.blockNo\)\}/);
  assert.match(contribution, /normalizeResidentFlatNo\(form\.flatNo, form\.blockNo\)/);
  assert.match(contribution, /E1006 accepted/);
  assert.match(contribution, /it will be removed automatically/);
  assert.match(contribution, /className="field-error"/);
  assert.match(contribution, /const blockPrefix = blockNo \? `\(\?:\$\{blockNo\}\)\?` : "\(\?:\[A-E\]\)\?"/);
  assert.match(contribution, /blockNo === "C" \? "0\[1-6\]"/);
  assert.match(donationDetail, /previousFlatNo:current\.flatNo,flatNo/);
  assert.match(donationDetail, /isValidFlatNo\(flatNo,current\.blockNo\)/);
  assert.match(donationDetail, /UPDATE registrations SET flat_no=\?/);
  assert.match(donationsScreen, /Administrator correction\. The block remains/);
  assert.match(summary, /THEN SUBSTR\(REPLACE\(REPLACE\(UPPER\(TRIM\(r\.flat_no\)\)/);
});

test("resident donations remain separate from occupied-flat coverage", async () => {
  const [registration, summaryRoute, summaryScreen, donationsRoute, donationsScreen, styles] = await Promise.all([
    source("app/api/registrations/route.ts"),
    source("app/api/collection-summary/route.ts"),
    source("app/collection-summary/CollectionSummary.tsx"),
    source("app/api/donations/route.ts"),
    source("app/donations/DonationsDashboard.tsx"),
    source("app/globals.css"),
  ]);
  assert.match(registration, /if \(user\) statements\.push/);
  assert.match(registration, /else statements\.push\(d1\.prepare\(`UPDATE flats SET/);
  assert.match(registration, /WHERE event_id=\? AND block_no=\? AND flat_no=\? AND occupied=1/);
  assert.doesNotMatch(registration, /occupied=1, visit_status='donated'/);
  assert.match(summaryRoute, /occupiedDonatedFlats/);
  assert.match(summaryRoute, /outsideMasterDonatingFlats/);
  assert.match(summaryRoute, /totalDonatingFlats \? Math\.round\(totalCollection \/ totalDonatingFlats\)/);
  assert.match(summaryScreen, /Occupied flats donated/);
  assert.match(summaryScreen, /Donating flats outside occupied master/);
  assert.match(donationsRoute, /inOccupiedMaster/);
  assert.match(donationsScreen, /Add to Occupied-Flat Master/);
  assert.match(styles, /\.master-membership\.outside/);
});

test("donated-flat Excel export is role-scoped and deduplicates repeat payments", async () => {
  const [route, screen, styles, packageFile] = await Promise.all([
    source("app/api/donations/export/route.ts"),
    source("app/donations/DonationsDashboard.tsx"),
    source("app/globals.css"),
    source("package.json"),
  ]);
  assert.match(route, /authorize\(request, \["admin", "block"\]\)/);
  assert.match(route, /auth\.user\.role === "block"/);
  assert.match(route, /exportBlocks\.map\(\(block\) => `Block \$\{block\}`\)/);
  assert.match(route, /\.\.\.BLOCKS/);
  assert.match(route, /normalizeFlatNo\(record\.flatNo, blockNo\)/);
  assert.match(route, /current\.donationCount \+= 1/);
  assert.match(route, /current\.totalAmount \+=/);
  assert.match(route, /No donations recorded for this block/);
  assert.match(route, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(route, /content-disposition/);
  assert.match(route, /private, no-store/);
  assert.match(screen, /href="\/api\/donations\/export"/);
  assert.match(screen, /Export Donated Flats \(\.xlsx\)/);
  assert.match(styles, /\.donation-list-actions/);
  assert.match(packageFile, /write-excel-file/);
});

test("donations can be filtered for zero Mahaprasadam attendance and contacted", async () => {
  const [screen, styles] = await Promise.all([
    source("app/donations/DonationsDashboard.tsx"),
    source("app/globals.css"),
  ]);
  assert.match(screen, /type AttendanceFilter = "all" \| "zero" \| "attending"/);
  assert.match(screen, /Number\(row\.adultCount\) === 0 && Number\(row\.childCount\) === 0/);
  assert.match(screen, /attendanceFilter === "zero" && totalAttendees === 0/);
  assert.match(screen, /Filter by Mahaprasadam attendance/);
  assert.match(screen, /<option value="zero">0 attendees \(\{zeroAttendanceCount\}\)<\/option>/);
  assert.match(screen, /Search resident, flat, phone or reference/);
  assert.match(screen, /please confirm/);
  assert.match(screen, /href=\{`tel:\+91\$\{selected\.phone\}`\}/);
  assert.match(screen, /records-shell\$\{selected \? "" : " records-shell-wide"\}/);
  assert.match(screen, /admin-card donation-records-card/);
  assert.match(styles, /\.attendance-filter/);
  assert.match(styles, /\.attendance-review/);
  assert.match(styles, /\.records-shell-wide\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(styles, /\.donation-records-card>header\{display:grid/);
});

test("duplicate review flags repeated flat submissions without changing valid donations", async () => {
  const [screen, styles] = await Promise.all([
    source("app/donations/DonationsDashboard.tsx"),
    source("app/globals.css"),
  ]);
  assert.match(screen, /type ReviewFilter = "all" \| "duplicates"/);
  assert.match(screen, /buildDuplicateReview\(rows\)/);
  assert.match(screen, /canonicalFlatNo\(row\.flatNo, row\.blockNo\)/);
  assert.match(screen, /Same payment reference appears more than once/);
  assert.match(screen, /Multiple forms but only one verified payment/);
  assert.match(screen, /Same phone number and amount appear more than once/);
  assert.match(screen, /Duplicate Review \(\{duplicateFlatCount\} flats\)/);
  assert.match(screen, /Genuine additional donations should be retained/);
  assert.match(styles, /\.duplicate-review-alert/);
  assert.match(styles, /\.duplicate-review-label/);
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
  assert.match(registration, /occupancy=CASE WHEN excluded\.occupancy<>'' THEN excluded\.occupancy ELSE flats\.occupancy END/);
  assert.match(chrome, /\/flat-status/);
  assert.match(migration, /ADD `occupied`/);
  assert.match(occupancyMigration, /ADD `occupancy` text NOT NULL DEFAULT ''/);
});
