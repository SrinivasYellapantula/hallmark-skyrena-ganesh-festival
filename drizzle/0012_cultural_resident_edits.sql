ALTER TABLE `cultural_programmes` ADD COLUMN `edit_token_hash` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cultural_programmes_edit_token` ON `cultural_programmes` (`edit_token_hash`);
