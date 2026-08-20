CREATE TABLE `event_finance_settings` (
	`event_id` text PRIMARY KEY NOT NULL,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`opening_balance_note` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT 'committee' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`)
);
