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
      donation_minimum INTEGER NOT NULL DEFAULT 2000,
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
      username TEXT UNIQUE,
      password_hash TEXT,
      password_salt TEXT,
      password_updated_at TEXT,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      block_no TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS app_sessions (
      token_hash TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES app_users(id),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS login_attempts (
      username TEXT PRIMARY KEY NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      window_started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_username ON app_users(username)",
    "CREATE INDEX IF NOT EXISTS idx_app_users_role_block ON app_users(role, block_no)",
    "CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON app_sessions(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_app_sessions_expiry ON app_sessions(expires_at)",
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

  const initialUsers = [
    ["initial-admin", "admin@local", "admin", "sMd4jOhPD5gCJMMC4x13ItQ6/NJwmwOOQuzSvLpKaeo=", "Ad/XCSp5mCEiqVpPV2vPYw==", "Administrator", "admin", null],
    ["initial-block-a", "a_user@local", "a_user", "ni5aQN4AWhbjun58PmPwJWPuAoLta06vQZqAhlzQRXw=", "3QnKsKQdYD9IIJFO0G38lQ==", "Block A Volunteer", "block", "A"],
    ["initial-block-b", "b_user@local", "b_user", "hjwqQiz2MGmbA2yhdVUlCue+eMIlm58Ip4aGzqTBBow=", "VzHGmrCWQyXiiyeSM2b54Q==", "Block B Volunteer", "block", "B"],
    ["initial-block-c", "c_user@local", "c_user", "NWvy2rQDfSr5+BBG4f8AYRFHAjPrJCysEmz5nzRHWUc=", "uhIfhIuTSNKiOPFMy6SU4Q==", "Block C Volunteer", "block", "C"],
    ["initial-block-d", "d_user@local", "d_user", "bAev+gKTxkR2Q/SPOwn+O/wuWfcWwXk/ZFUB6Cg2KLE=", "j2wxXLd05zWU7eaGwtf9Ew==", "Block D Volunteer", "block", "D"],
    ["initial-block-e", "e_user@local", "e_user", "vccRn4s+FRXhTe/62VBy1Ks2hZYeo4UrjLh37IgJOtI=", "IOF7jioPkSYfgICti6nGqg==", "Block E Volunteer", "block", "E"],
  ] as const;
  await d1.batch(initialUsers.map((user) => d1.prepare(
    `INSERT INTO app_users
      (id,email,username,password_hash,password_salt,password_updated_at,display_name,role,block_no,active,created_by)
     VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,?,?,?,1,'system')
     ON CONFLICT(username) DO NOTHING`,
  ).bind(...user)));
}
