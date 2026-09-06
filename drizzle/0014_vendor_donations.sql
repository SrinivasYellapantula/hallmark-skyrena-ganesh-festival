ALTER TABLE registrations ADD COLUMN donor_type TEXT NOT NULL DEFAULT 'resident';
ALTER TABLE registrations ADD COLUMN vendor_category TEXT NOT NULL DEFAULT '';
ALTER TABLE registrations ADD COLUMN contact_person TEXT NOT NULL DEFAULT '';
ALTER TABLE registrations ADD COLUMN vendor_address TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_registrations_donor_type ON registrations(event_id, donor_type);
