import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  donationMinimum: integer("donation_minimum").notNull().default(2000),
  status: text("status", { enum: ["draft", "open", "closed"] })
    .notNull()
    .default("open"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const registrations = sqliteTable(
  "registrations",
  {
    id: text("id").primaryKey(),
    referenceNo: text("reference_no").notNull().unique(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    residentName: text("resident_name").notNull(),
    blockNo: text("block_no").notNull(),
    flatNo: text("flat_no").notNull(),
    gotram: text("gotram").notNull(),
    occupancy: text("occupancy", { enum: ["owner", "tenant"] }).notNull(),
    phone: text("phone"),
    adultCount: integer("adult_count").notNull().default(0),
    childCount: integer("child_count").notNull().default(0),
    publicNameConsent: integer("public_name_consent", { mode: "boolean" })
      .notNull()
      .default(false),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull().default("committee"),
    status: text("status", {
      enum: ["submitted", "verified", "cancelled"],
    })
      .notNull()
      .default("submitted"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_registrations_event_block_flat").on(
      table.eventId,
      table.blockNo,
      table.flatNo,
    ),
    index("idx_registrations_status_created").on(table.status, table.createdAt),
  ],
);

export const donations = sqliteTable(
  "donations",
  {
    id: text("id").primaryKey(),
    registrationId: text("registration_id")
      .notNull()
      .references(() => registrations.id),
    category: text("category", { enum: ["festival", "annadaanam"] }).notNull(),
    amount: integer("amount").notNull(),
    paymentMethod: text("payment_method", {
      enum: ["upi", "cash", "bank_transfer"],
    }).notNull(),
    paymentReference: text("payment_reference").notNull().default(""),
    status: text("status", { enum: ["pending", "verified", "reversed"] })
      .notNull()
      .default("pending"),
    receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    verifiedAt: text("verified_at"),
    verifiedBy: text("verified_by"),
    paymentProofKey: text("payment_proof_key"),
    paymentProofName: text("payment_proof_name"),
    paymentProofType: text("payment_proof_type"),
  },
  (table) => [
    index("idx_donations_registration").on(table.registrationId),
    index("idx_donations_status_category").on(table.status, table.category),
  ],
);

export const appUsers = sqliteTable(
  "app_users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    username: text("username"),
    passwordHash: text("password_hash"),
    passwordSalt: text("password_salt"),
    passwordUpdatedAt: text("password_updated_at"),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["admin", "block", "cultural"] }).notNull(),
    blockNo: text("block_no"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_app_users_email").on(table.email),
    uniqueIndex("idx_app_users_username").on(table.username),
    index("idx_app_users_role_block").on(table.role, table.blockNo),
  ],
);

export const appSessions = sqliteTable(
  "app_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull().references(() => appUsers.id),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_app_sessions_user").on(table.userId),
    index("idx_app_sessions_expiry").on(table.expiresAt),
  ],
);

export const loginAttempts = sqliteTable("login_attempts", {
  username: text("username").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStartedAt: text("window_started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const flats = sqliteTable(
  "flats",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id),
    blockNo: text("block_no").notNull(),
    flatNo: text("flat_no").notNull(),
    residentName: text("resident_name").notNull().default(""),
    occupied: integer("occupied", { mode: "boolean" }).notNull().default(true),
    visitStatus: text("visit_status", { enum: ["pending", "visited", "visit_again", "donated"] }).notNull().default("pending"),
    visitNotes: text("visit_notes").notNull().default(""),
    lastVisitedAt: text("last_visited_at"),
    updatedBy: text("updated_by").notNull().default("committee"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_flats_event_block_flat").on(table.eventId, table.blockNo, table.flatNo),
    index("idx_flats_block_status").on(table.blockNo, table.visitStatus),
  ],
);

export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    category: text("category").notNull(),
    vendor: text("vendor").notNull(),
    description: text("description").notNull(),
    amount: integer("amount").notNull(),
    expenseDate: text("expense_date").notNull(),
    receiptUrl: text("receipt_url").notNull().default(""),
    receiptProofKey: text("receipt_proof_key"),
    receiptProofName: text("receipt_proof_name"),
    receiptProofType: text("receipt_proof_type"),
    status: text("status", { enum: ["draft", "approved", "reversed"] })
      .notNull()
      .default("approved"),
    createdBy: text("created_by").notNull().default("committee"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_expenses_event_status_date").on(
      table.eventId,
      table.status,
      table.expenseDate,
    ),
  ],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    actor: text("actor").notNull(),
    details: text("details").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_audit_entity_created").on(table.entityType, table.entityId, table.createdAt)],
);

export const meetingMinutes = sqliteTable(
  "meeting_minutes",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id),
    title: text("title").notNull(),
    meetingDate: text("meeting_date").notNull(),
    startTime: text("start_time").notNull().default(""),
    endTime: text("end_time").notNull().default(""),
    venue: text("venue").notNull().default(""),
    chairperson: text("chairperson").notNull().default(""),
    attendees: text("attendees").notNull().default(""),
    absentees: text("absentees").notNull().default(""),
    agenda: text("agenda").notNull().default(""),
    discussion: text("discussion").notNull().default(""),
    decisions: text("decisions").notNull().default(""),
    nextMeetingDate: text("next_meeting_date").notNull().default(""),
    status: text("status", { enum: ["draft", "final"] }).notNull().default("draft"),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_meeting_minutes_event_date").on(table.eventId, table.meetingDate)],
);

export const meetingActionItems = sqliteTable(
  "meeting_action_items",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id").notNull().references(() => meetingMinutes.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    owner: text("owner").notNull().default(""),
    dueDate: text("due_date").notNull().default(""),
    priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
    status: text("status", { enum: ["open", "in_progress", "completed"] }).notNull().default("open"),
    notes: text("notes").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("idx_meeting_actions_meeting").on(table.meetingId, table.sortOrder)],
);

export const culturalProgrammes = sqliteTable(
  "cultural_programmes",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id),
    title: text("title").notNull(),
    category: text("category").notNull(),
    participantDetails: text("participant_details").notNull().default(""),
    coordinator: text("coordinator").notNull().default(""),
    blockNo: text("block_no").notNull().default(""),
    flatNo: text("flat_no").notNull().default(""),
    programmeDate: text("programme_date").notNull().default(""),
    startTime: text("start_time").notNull().default(""),
    durationMinutes: integer("duration_minutes").notNull().default(10),
    status: text("status", { enum: ["proposed", "confirmed", "completed", "cancelled"] }).notNull().default("proposed"),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_cultural_programmes_event_date").on(table.eventId, table.programmeDate)],
);
