import { getD1 } from ".";

let initialized: Promise<void> | null = null;

export function ensureDatabase() {
  initialized ??= initialize();
  return initialized;
}

async function initialize() {
  const d1 = getD1();
  const statements = [
    `CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      donation_minimum INTEGER NOT NULL DEFAULT 1000,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY NOT NULL,
      reference_no TEXT NOT NULL UNIQUE,
      event_id TEXT NOT NULL REFERENCES events(id),
      resident_name TEXT NOT NULL,
      block_no TEXT NOT NULL,
      flat_no TEXT NOT NULL,
      gotram TEXT NOT NULL,
      occupancy TEXT NOT NULL,
      phone TEXT,
      adult_count INTEGER NOT NULL DEFAULT 0,
      child_count INTEGER NOT NULL DEFAULT 0,
      public_name_consent INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT 'committee',
      status TEXT NOT NULL DEFAULT 'submitted',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY NOT NULL,
      registration_id TEXT NOT NULL REFERENCES registrations(id),
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      payment_reference TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      verified_at TEXT,
      verified_by TEXT
      ,payment_proof_key TEXT
      ,payment_proof_name TEXT
      ,payment_proof_type TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      block_no TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS flats (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL REFERENCES events(id),
      block_no TEXT NOT NULL,
      flat_no TEXT NOT NULL,
      resident_name TEXT NOT NULL DEFAULT '',
      visit_status TEXT NOT NULL DEFAULT 'pending',
      visit_notes TEXT NOT NULL DEFAULT '',
      last_visited_at TEXT,
      updated_by TEXT NOT NULL DEFAULT 'committee',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL REFERENCES events(id),
      category TEXT NOT NULL,
      vendor TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      expense_date TEXT NOT NULL,
      receipt_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'approved',
      created_by TEXT NOT NULL DEFAULT 'committee',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    "CREATE INDEX IF NOT EXISTS idx_registrations_event_block_flat ON registrations(event_id, block_no, flat_no)",
    "CREATE INDEX IF NOT EXISTS idx_registrations_status_created ON registrations(status, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_donations_registration ON donations(registration_id)",
    "CREATE INDEX IF NOT EXISTS idx_donations_status_category ON donations(status, category)",
    "CREATE INDEX IF NOT EXISTS idx_expenses_event_status_date ON expenses(event_id, status, expense_date)",
    "CREATE INDEX IF NOT EXISTS idx_audit_entity_created ON audit_log(entity_type, entity_id, created_at)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email)",
    "CREATE INDEX IF NOT EXISTS idx_app_users_role_block ON app_users(role, block_no)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_flats_event_block_flat ON flats(event_id, block_no, flat_no)",
    "CREATE INDEX IF NOT EXISTS idx_flats_block_status ON flats(block_no, visit_status)",
  ];

  await d1.batch(statements.map((statement) => d1.prepare(statement)));
  await d1
    .prepare(
      `INSERT INTO events (id, name, year, donation_minimum, status)
       VALUES (?, ?, ?, ?, 'open')
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         year = excluded.year,
         donation_minimum = excluded.donation_minimum`,
    )
    .bind("ganesh-2026", "Hallmark Skyrena, Ganesh Chaturthi 2026", 2026, 2000)
    .run();
}
