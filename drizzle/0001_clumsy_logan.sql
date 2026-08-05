CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`block_no` text,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_app_users_email` ON `app_users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_app_users_role_block` ON `app_users` (`role`,`block_no`);--> statement-breakpoint
CREATE TABLE `flats` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`block_no` text NOT NULL,
	`flat_no` text NOT NULL,
	`resident_name` text DEFAULT '' NOT NULL,
	`visit_status` text DEFAULT 'pending' NOT NULL,
	`visit_notes` text DEFAULT '' NOT NULL,
	`last_visited_at` text,
	`updated_by` text DEFAULT 'committee' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_flats_event_block_flat` ON `flats` (`event_id`,`block_no`,`flat_no`);--> statement-breakpoint
CREATE INDEX `idx_flats_block_status` ON `flats` (`block_no`,`visit_status`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`year` integer NOT NULL,
	`donation_minimum` integer DEFAULT 2000 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_events`("id", "name", "year", "donation_minimum", "status", "created_at") SELECT "id", "name", "year", "donation_minimum", "status", "created_at" FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `donations` ADD `payment_proof_key` text;--> statement-breakpoint
ALTER TABLE `donations` ADD `payment_proof_name` text;--> statement-breakpoint
ALTER TABLE `donations` ADD `payment_proof_type` text;--> statement-breakpoint
ALTER TABLE `registrations` ADD `created_by` text DEFAULT 'committee' NOT NULL;