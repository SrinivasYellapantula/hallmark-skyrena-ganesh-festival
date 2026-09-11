CREATE TABLE IF NOT EXISTS pooja_registrations (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id),
  reference_no TEXT NOT NULL UNIQUE,
  pooja_type TEXT NOT NULL,
  pooja_date TEXT NOT NULL,
  session TEXT NOT NULL DEFAULT '',
  block_no TEXT NOT NULL,
  flat_no TEXT NOT NULL,
  resident_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  attendee_count INTEGER NOT NULL DEFAULT 1,
  participant_details TEXT NOT NULL DEFAULT '[]',
  payment_amount INTEGER NOT NULL DEFAULT 0,
  payment_reference TEXT NOT NULL DEFAULT '',
  payment_proof_key TEXT,
  payment_proof_name TEXT,
  payment_proof_type TEXT,
  payment_status TEXT NOT NULL DEFAULT 'not_required',
  status TEXT NOT NULL DEFAULT 'submitted',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'resident-self-service',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pooja_registrations_type_date ON pooja_registrations(event_id,pooja_type,pooja_date,status);
CREATE INDEX IF NOT EXISTS idx_pooja_registrations_block_flat ON pooja_registrations(event_id,block_no,flat_no);
