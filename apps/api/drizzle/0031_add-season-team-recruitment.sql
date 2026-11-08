CREATE TABLE `recruitment_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`card_id` int NOT NULL,
	`applicant_user_id` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`decided_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recruitment_applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_recruitment_applications_card_applicant` UNIQUE(`card_id`,`applicant_user_id`)
);
--> statement-breakpoint
CREATE TABLE `recruitment_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`season_id` int NOT NULL,
	`season_project_id` int NOT NULL,
	`creator_user_id` varchar(255) NOT NULL,
	`roles` json NOT NULL,
	`skills` json NOT NULL,
	`description` text NOT NULL,
	`deadline` timestamp NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'open',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recruitment_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `season_project_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`season_project_id` int NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`role` varchar(16) NOT NULL DEFAULT 'core',
	`status` varchar(16) NOT NULL DEFAULT 'invited',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `season_project_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_season_project_members_project_user` UNIQUE(`season_project_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `season_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`season_id` int NOT NULL,
	`project_id` int NOT NULL,
	`owner_user_id` varchar(255) NOT NULL,
	`source` varchar(16) NOT NULL DEFAULT 'created',
	`themes` json NOT NULL,
	`challenge_ids` json NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'published',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `season_projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_season_projects_season_project` UNIQUE(`season_id`,`project_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_recruitment_applications_card_status` ON `recruitment_applications` (`card_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_recruitment_applications_applicant` ON `recruitment_applications` (`applicant_user_id`);--> statement-breakpoint
CREATE INDEX `idx_recruitment_cards_season_status` ON `recruitment_cards` (`season_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_recruitment_cards_project` ON `recruitment_cards` (`season_project_id`);--> statement-breakpoint
CREATE INDEX `idx_recruitment_cards_creator` ON `recruitment_cards` (`creator_user_id`);--> statement-breakpoint
CREATE INDEX `idx_season_project_members_user` ON `season_project_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_season_projects_season_status` ON `season_projects` (`season_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_season_projects_owner` ON `season_projects` (`owner_user_id`);