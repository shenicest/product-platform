CREATE TABLE `audit_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`operator_id` varchar(255) NOT NULL,
	`action` varchar(32) NOT NULL,
	`proposal_id` int,
	`reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 0,
	`name` varchar(255) NOT NULL,
	`tagline` varchar(255),
	`description` text,
	`cover_url` varchar(255),
	`demo_images` json,
	`demo_video_url` varchar(255),
	`demo_link` varchar(255),
	`stage` tinyint,
	`categories` json,
	`target_users` text,
	`user_problem` text,
	`progress` text,
	`next_steps` text,
	`message_to_users` text,
	`is_open_for_beta` boolean,
	`beta_description` text,
	`contact_name` varchar(255),
	`contact_phone` varchar(255),
	`contact_email` varchar(255),
	`contact_wechat` varchar(255),
	`team_name` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_edit_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`changes` json NOT NULL,
	`status` tinyint NOT NULL DEFAULT 0,
	`reason` text,
	`reviewed_by` varchar(255),
	`reviewed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_edit_proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_audit_records_project_id` ON `audit_records` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_records_operator_id` ON `audit_records` (`operator_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_records_created_at` ON `audit_records` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_projects_user_id` ON `projects` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_status` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `idx_projects_stage` ON `projects` (`stage`);--> statement-breakpoint
CREATE INDEX `idx_proposals_project_id` ON `project_edit_proposals` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_proposals_status` ON `project_edit_proposals` (`status`);