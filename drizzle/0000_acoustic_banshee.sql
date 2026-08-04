CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_entity_created` ON `audit_log` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `donations` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`category` text NOT NULL,
	`amount` integer NOT NULL,
	`payment_method` text NOT NULL,
	`payment_reference` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`verified_at` text,
	`verified_by` text,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_donations_registration` ON `donations` (`registration_id`);--> statement-breakpoint
CREATE INDEX `idx_donations_status_category` ON `donations` (`status`,`category`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`year` integer NOT NULL,
	`donation_minimum` integer DEFAULT 1000 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`category` text NOT NULL,
	`vendor` text NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`expense_date` text NOT NULL,
	`receipt_url` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`created_by` text DEFAULT 'committee' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_event_status_date` ON `expenses` (`event_id`,`status`,`expense_date`);--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`reference_no` text NOT NULL,
	`event_id` text NOT NULL,
	`resident_name` text NOT NULL,
	`block_no` text NOT NULL,
	`flat_no` text NOT NULL,
	`gotram` text NOT NULL,
	`occupancy` text NOT NULL,
	`phone` text,
	`adult_count` integer DEFAULT 0 NOT NULL,
	`child_count` integer DEFAULT 0 NOT NULL,
	`public_name_consent` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_reference_no_unique` ON `registrations` (`reference_no`);--> statement-breakpoint
CREATE INDEX `idx_registrations_event_block_flat` ON `registrations` (`event_id`,`block_no`,`flat_no`);--> statement-breakpoint
CREATE INDEX `idx_registrations_status_created` ON `registrations` (`status`,`created_at`);