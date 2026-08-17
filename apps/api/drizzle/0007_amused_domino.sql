CREATE TABLE `connection_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sender_user_id` varchar(255) NOT NULL,
	`receiver_user_id` varchar(255) NOT NULL,
	`project_id` int,
	`purpose` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`sender_contact` text NOT NULL,
	`receiver_contact` text,
	`status` tinyint NOT NULL,
	`accepted_at` timestamp,
	`handled_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `connection_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `talent_moderation_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`talent_profile_id` int NOT NULL,
	`operator_id` varchar(255) NOT NULL,
	`action` varchar(32) NOT NULL,
	`reason` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `talent_moderation_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `talent_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`status` tinyint NOT NULL,
	`headline` varchar(255) NOT NULL,
	`bio` text NOT NULL,
	`city` varchar(100),
	`roles` json NOT NULL,
	`skills` json NOT NULL,
	`seeking_skills` json NOT NULL,
	`domains` json NOT NULL,
	`durations` json NOT NULL,
	`published_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `talent_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_talent_profiles_user_id` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_connection_requests_sender` ON `connection_requests` (`sender_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_connection_requests_receiver_status` ON `connection_requests` (`receiver_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_connection_requests_pair` ON `connection_requests` (`sender_user_id`,`receiver_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_talent_moderation_profile` ON `talent_moderation_records` (`talent_profile_id`);--> statement-breakpoint
CREATE INDEX `idx_talent_profiles_status_updated` ON `talent_profiles` (`status`,`updated_at`);