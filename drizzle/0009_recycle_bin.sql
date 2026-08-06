CREATE TABLE `recycle_bin` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `entity_label` text NOT NULL,
  `restore_data` text NOT NULL DEFAULT '{}',
  `deleted_by` text NOT NULL,
  `deleted_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `restored_by` text,
  `restored_at` text,
  `status` text NOT NULL DEFAULT 'active',
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_recycle_event_status_deleted` ON `recycle_bin` (`event_id`,`status`,`deleted_at`);
--> statement-breakpoint
CREATE INDEX `idx_recycle_entity` ON `recycle_bin` (`entity_type`,`entity_id`);
