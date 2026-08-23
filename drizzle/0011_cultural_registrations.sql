ALTER TABLE `cultural_programmes` ADD COLUMN `reference_no` text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `cultural_programmes` ADD COLUMN `performance_type` text NOT NULL DEFAULT 'solo';--> statement-breakpoint
ALTER TABLE `cultural_programmes` ADD COLUMN `contact_name` text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `cultural_programmes` ADD COLUMN `contact_phone` text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `cultural_programmes` ADD COLUMN `background_music` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `cultural_programmes` ADD COLUMN `audio_key` text;--> statement-breakpoint
ALTER TABLE `cultural_programmes` ADD COLUMN `audio_name` text;--> statement-breakpoint
ALTER TABLE `cultural_programmes` ADD COLUMN `audio_type` text;--> statement-breakpoint
ALTER TABLE `cultural_programmes` ADD COLUMN `stage_requirements` text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `cultural_programmes` ADD COLUMN `props_requirements` text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `cultural_programmes` ADD COLUMN `setup_minutes` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `cultural_programmes` ADD COLUMN `source` text NOT NULL DEFAULT 'committee';--> statement-breakpoint
UPDATE `cultural_programmes` SET `reference_no`='CP26-' || UPPER(SUBSTR(REPLACE(`id`,'-',''),1,8)) WHERE `reference_no`='';--> statement-breakpoint
UPDATE `cultural_programmes` SET `status`='submitted' WHERE `status`='proposed';--> statement-breakpoint
UPDATE `cultural_programmes` SET `status`='approved' WHERE `status`='confirmed';--> statement-breakpoint
UPDATE `cultural_programmes` SET `status`='withdrawn' WHERE `status`='cancelled';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cultural_programmes_reference` ON `cultural_programmes` (`reference_no`);
