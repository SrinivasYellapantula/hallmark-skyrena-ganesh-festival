CREATE TABLE IF NOT EXISTS prasadam_offerings (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id),
  reference_no TEXT NOT NULL UNIQUE,
  block_no TEXT NOT NULL,
  flat_no TEXT NOT NULL,
  resident_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  offering_date TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  prasadam_name TEXT NOT NULL,
  portions INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted',
  created_by TEXT NOT NULL DEFAULT 'resident-self-service',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prasadam_offerings_event_date ON prasadam_offerings(event_id, offering_date, status);
CREATE INDEX IF NOT EXISTS idx_prasadam_offerings_block_flat ON prasadam_offerings(event_id, block_no, flat_no);
