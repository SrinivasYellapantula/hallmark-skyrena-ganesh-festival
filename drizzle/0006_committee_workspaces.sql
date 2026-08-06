CREATE TABLE `meeting_minutes` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL REFERENCES `events`(`id`),
  `title` text NOT NULL,
  `meeting_date` text NOT NULL,
  `start_time` text NOT NULL DEFAULT '',
  `end_time` text NOT NULL DEFAULT '',
  `venue` text NOT NULL DEFAULT '',
  `chairperson` text NOT NULL DEFAULT '',
  `attendees` text NOT NULL DEFAULT '',
  `absentees` text NOT NULL DEFAULT '',
  `agenda` text NOT NULL DEFAULT '',
  `discussion` text NOT NULL DEFAULT '',
  `decisions` text NOT NULL DEFAULT '',
  `next_meeting_date` text NOT NULL DEFAULT '',
  `status` text NOT NULL DEFAULT 'draft',
  `created_by` text NOT NULL,
  `updated_by` text NOT NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);--> statement-breakpoint
CREATE INDEX `idx_meeting_minutes_event_date` ON `meeting_minutes` (`event_id`,`meeting_date`);--> statement-breakpoint
CREATE TABLE `meeting_action_items` (
  `id` text PRIMARY KEY NOT NULL,
  `meeting_id` text NOT NULL REFERENCES `meeting_minutes`(`id`) ON DELETE CASCADE,
  `description` text NOT NULL,
  `owner` text NOT NULL DEFAULT '',
  `due_date` text NOT NULL DEFAULT '',
  `priority` text NOT NULL DEFAULT 'medium',
  `status` text NOT NULL DEFAULT 'open',
  `notes` text NOT NULL DEFAULT '',
  `sort_order` integer NOT NULL DEFAULT 0
);--> statement-breakpoint
CREATE INDEX `idx_meeting_actions_meeting` ON `meeting_action_items` (`meeting_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `cultural_programmes` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL REFERENCES `events`(`id`),
  `title` text NOT NULL,
  `category` text NOT NULL,
  `participant_details` text NOT NULL DEFAULT '',
  `coordinator` text NOT NULL DEFAULT '',
  `block_no` text NOT NULL DEFAULT '',
  `flat_no` text NOT NULL DEFAULT '',
  `programme_date` text NOT NULL DEFAULT '',
  `start_time` text NOT NULL DEFAULT '',
  `duration_minutes` integer NOT NULL DEFAULT 10,
  `status` text NOT NULL DEFAULT 'proposed',
  `notes` text NOT NULL DEFAULT '',
  `created_by` text NOT NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);--> statement-breakpoint
CREATE INDEX `idx_cultural_programmes_event_date` ON `cultural_programmes` (`event_id`,`programme_date`);
--> statement-breakpoint
UPDATE `app_users` SET `username`='block_a_coordinator', `email`='block_a_coordinator@local', `display_name`='Block A Coordinator', `updated_at`=CURRENT_TIMESTAMP WHERE `username`='a_user';--> statement-breakpoint
UPDATE `app_users` SET `username`='block_b_coordinator', `email`='block_b_coordinator@local', `display_name`='Block B Coordinator', `updated_at`=CURRENT_TIMESTAMP WHERE `username`='b_user';--> statement-breakpoint
UPDATE `app_users` SET `username`='block_c_coordinator', `email`='block_c_coordinator@local', `display_name`='Block C Coordinator', `updated_at`=CURRENT_TIMESTAMP WHERE `username`='c_user';--> statement-breakpoint
UPDATE `app_users` SET `username`='block_d_coordinator', `email`='block_d_coordinator@local', `display_name`='Block D Coordinator', `updated_at`=CURRENT_TIMESTAMP WHERE `username`='d_user';--> statement-breakpoint
UPDATE `app_users` SET `username`='block_e_coordinator', `email`='block_e_coordinator@local', `display_name`='Block E Coordinator', `updated_at`=CURRENT_TIMESTAMP WHERE `username`='e_user';
