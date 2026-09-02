ALTER TABLE `cultural_programmes` ADD COLUMN `audio_arrangement` text NOT NULL DEFAULT 'upload';
--> statement-breakpoint
ALTER TABLE `cultural_programmes` ADD COLUMN `device_details` text NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE `cultural_programmes` SET `audio_arrangement`=CASE WHEN `audio_key` IS NOT NULL THEN 'upload' ELSE 'own_device' END;
