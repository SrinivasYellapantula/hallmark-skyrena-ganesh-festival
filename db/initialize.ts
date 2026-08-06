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
      occupancy TEXT NOT NULL DEFAULT '',
      occupied INTEGER NOT NULL DEFAULT 1,
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
      receipt_proof_key TEXT,
      receipt_proof_name TEXT,
      receipt_proof_type TEXT,
      status TEXT NOT NULL DEFAULT 'approved',
      created_by TEXT NOT NULL DEFAULT 'committee',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS meeting_minutes (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL REFERENCES events(id),
      title TEXT NOT NULL,
      meeting_date TEXT NOT NULL,
      start_time TEXT NOT NULL DEFAULT '',
      end_time TEXT NOT NULL DEFAULT '',
      venue TEXT NOT NULL DEFAULT '',
      chairperson TEXT NOT NULL DEFAULT '',
      attendees TEXT NOT NULL DEFAULT '',
      absentees TEXT NOT NULL DEFAULT '',
      agenda TEXT NOT NULL DEFAULT '',
      discussion TEXT NOT NULL DEFAULT '',
      decisions TEXT NOT NULL DEFAULT '',
      next_meeting_date TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS meeting_action_items (
      id TEXT PRIMARY KEY NOT NULL,
      meeting_id TEXT NOT NULL REFERENCES meeting_minutes(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      owner TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      notes TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS cultural_programmes (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL REFERENCES events(id),
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      participant_details TEXT NOT NULL DEFAULT '',
      coordinator TEXT NOT NULL DEFAULT '',
      block_no TEXT NOT NULL DEFAULT '',
      flat_no TEXT NOT NULL DEFAULT '',
      programme_date TEXT NOT NULL DEFAULT '',
      start_time TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'proposed',
      notes TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    "CREATE INDEX IF NOT EXISTS idx_meeting_minutes_event_date ON meeting_minutes(event_id, meeting_date)",
    "CREATE INDEX IF NOT EXISTS idx_meeting_actions_meeting ON meeting_action_items(meeting_id, sort_order)",
    "CREATE INDEX IF NOT EXISTS idx_cultural_programmes_event_date ON cultural_programmes(event_id, programme_date)",
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
    ["initial-block-a", "block_a_coordinator@local", "block_a_coordinator", "ni5aQN4AWhbjun58PmPwJWPuAoLta06vQZqAhlzQRXw=", "3QnKsKQdYD9IIJFO0G38lQ==", "Block A Coordinator", "block", "A"],
    ["initial-block-b", "block_b_coordinator@local", "block_b_coordinator", "hjwqQiz2MGmbA2yhdVUlCue+eMIlm58Ip4aGzqTBBow=", "VzHGmrCWQyXiiyeSM2b54Q==", "Block B Coordinator", "block", "B"],
    ["initial-block-c", "block_c_coordinator@local", "block_c_coordinator", "NWvy2rQDfSr5+BBG4f8AYRFHAjPrJCysEmz5nzRHWUc=", "uhIfhIuTSNKiOPFMy6SU4Q==", "Block C Coordinator", "block", "C"],
    ["initial-block-d", "block_d_coordinator@local", "block_d_coordinator", "bAev+gKTxkR2Q/SPOwn+O/wuWfcWwXk/ZFUB6Cg2KLE=", "j2wxXLd05zWU7eaGwtf9Ew==", "Block D Coordinator", "block", "D"],
    ["initial-block-e", "block_e_coordinator@local", "block_e_coordinator", "vccRn4s+FRXhTe/62VBy1Ks2hZYeo4UrjLh37IgJOtI=", "IOF7jioPkSYfgICti6nGqg==", "Block E Coordinator", "block", "E"],
  ] as const;
  await d1.batch(initialUsers.map((user) => d1.prepare(
    `INSERT INTO app_users
      (id,email,username,password_hash,password_salt,password_updated_at,display_name,role,block_no,active,created_by)
     VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,?,?,?,1,'system')
     ON CONFLICT DO NOTHING`,
  ).bind(...user)));
}
