import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  donationMinimum: integer("donation_minimum").notNull().default(1000),
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
  },
  (table) => [
    index("idx_donations_registration").on(table.registrationId),
    index("idx_donations_status_category").on(table.status, table.category),
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
