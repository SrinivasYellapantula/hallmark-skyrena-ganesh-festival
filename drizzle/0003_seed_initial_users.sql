INSERT INTO app_users
  (id,email,username,password_hash,password_salt,password_updated_at,display_name,role,block_no,active,created_by)
VALUES
  ('initial-admin','admin@local','admin','4/sr/Z8IiGh9/JD63YaHh5HazuRqjTmb/VaPQJxkGfU=','Ad/XCSp5mCEiqVpPV2vPYw==',CURRENT_TIMESTAMP,'Administrator','admin',NULL,1,'system')
ON CONFLICT(username) DO UPDATE SET
  password_hash=excluded.password_hash,password_salt=excluded.password_salt,password_updated_at=CURRENT_TIMESTAMP,
  display_name=excluded.display_name,role='admin',block_no=NULL,active=1,updated_at=CURRENT_TIMESTAMP;

INSERT INTO app_users
  (id,email,username,password_hash,password_salt,password_updated_at,display_name,role,block_no,active,created_by)
VALUES
  ('initial-block-a','a_user@local','a_user','eQ5+PM4tx/T486HHMWc1SUGHTeOWHEoKrCOHuyBDNVo=','3QnKsKQdYD9IIJFO0G38lQ==',CURRENT_TIMESTAMP,'Block A Volunteer','block','A',1,'system'),
  ('initial-block-b','b_user@local','b_user','7FRyri1nEnx2Ar6SZazkaSNur8r/BH3PPnhOMURhKxc=','VzHGmrCWQyXiiyeSM2b54Q==',CURRENT_TIMESTAMP,'Block B Volunteer','block','B',1,'system'),
  ('initial-block-c','c_user@local','c_user','eT7UWDZ4DEmfHds9OljQfododL0o41HMfm/6kqdv89Y=','uhIfhIuTSNKiOPFMy6SU4Q==',CURRENT_TIMESTAMP,'Block C Volunteer','block','C',1,'system'),
  ('initial-block-d','d_user@local','d_user','77O+e+L0raIQRGHfmyqTFhWLwfaXWVXw1fK43cL5VMM=','j2wxXLd05zWU7eaGwtf9Ew==',CURRENT_TIMESTAMP,'Block D Volunteer','block','D',1,'system'),
  ('initial-block-e','e_user@local','e_user','VjNrkIcTQGFVRCCgQYufoUcNzXTs+gE0BabVoQkmxl0=','IOF7jioPkSYfgICti6nGqg==',CURRENT_TIMESTAMP,'Block E Volunteer','block','E',1,'system')
ON CONFLICT(username) DO UPDATE SET
  password_hash=excluded.password_hash,password_salt=excluded.password_salt,password_updated_at=CURRENT_TIMESTAMP,
  display_name=excluded.display_name,role='block',block_no=excluded.block_no,active=1,updated_at=CURRENT_TIMESTAMP;

DELETE FROM app_sessions WHERE user_id IN (
  SELECT id FROM app_users WHERE username IN ('admin','a_user','b_user','c_user','d_user','e_user')
);
DELETE FROM login_attempts WHERE username IN ('admin','a_user','b_user','c_user','d_user','e_user');
