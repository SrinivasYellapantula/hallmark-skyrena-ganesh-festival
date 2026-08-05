-- Cloudflare Workers supports PBKDF2 iteration counts up to 100,000.
-- Re-hash the initial accounts with their existing salts at that limit.
UPDATE `app_users`
SET `password_hash` = 'sMd4jOhPD5gCJMMC4x13ItQ6/NJwmwOOQuzSvLpKaeo=',
    `password_updated_at` = CURRENT_TIMESTAMP,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `username` = 'admin';
--> statement-breakpoint
UPDATE `app_users`
SET `password_hash` = 'ni5aQN4AWhbjun58PmPwJWPuAoLta06vQZqAhlzQRXw=',
    `password_updated_at` = CURRENT_TIMESTAMP,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `username` = 'a_user';
--> statement-breakpoint
UPDATE `app_users`
SET `password_hash` = 'hjwqQiz2MGmbA2yhdVUlCue+eMIlm58Ip4aGzqTBBow=',
    `password_updated_at` = CURRENT_TIMESTAMP,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `username` = 'b_user';
--> statement-breakpoint
UPDATE `app_users`
SET `password_hash` = 'NWvy2rQDfSr5+BBG4f8AYRFHAjPrJCysEmz5nzRHWUc=',
    `password_updated_at` = CURRENT_TIMESTAMP,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `username` = 'c_user';
--> statement-breakpoint
UPDATE `app_users`
SET `password_hash` = 'bAev+gKTxkR2Q/SPOwn+O/wuWfcWwXk/ZFUB6Cg2KLE=',
    `password_updated_at` = CURRENT_TIMESTAMP,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `username` = 'd_user';
--> statement-breakpoint
UPDATE `app_users`
SET `password_hash` = 'vccRn4s+FRXhTe/62VBy1Ks2hZYeo4UrjLh37IgJOtI=',
    `password_updated_at` = CURRENT_TIMESTAMP,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `username` = 'e_user';
--> statement-breakpoint
DELETE FROM `app_sessions`
WHERE `user_id` IN (
  SELECT `id` FROM `app_users`
  WHERE `username` IN ('admin', 'a_user', 'b_user', 'c_user', 'd_user', 'e_user')
);
--> statement-breakpoint
DELETE FROM `login_attempts`
WHERE `username` IN ('admin', 'a_user', 'b_user', 'c_user', 'd_user', 'e_user');
