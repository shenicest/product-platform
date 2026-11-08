CREATE TABLE `challenge_follows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`challenge_id` int NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `challenge_follows_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_challenge_follows_challenge_user` UNIQUE(`challenge_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `challenge_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`challenge_id` int NOT NULL,
	`version` int NOT NULL,
	`note` varchar(255) NOT NULL,
	`changed_by` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `challenge_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `challenges` ADD `summary` varchar(200);--> statement-breakpoint
ALTER TABLE `challenges` ADD `background` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `industry` varchar(100);--> statement-breakpoint
ALTER TABLE `challenges` ADD `scope` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `out_of_scope` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `monthly_goal` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `suggested_skills` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `challenges` ADD `team_capacity` int;--> statement-breakpoint
ALTER TABLE `challenges` ADD `owner_name` varchar(100);--> statement-breakpoint
ALTER TABLE `challenges` ADD `response_sla` varchar(100);--> statement-breakpoint
ALTER TABLE `challenges` ADD `scoring_weights` json;--> statement-breakpoint
ALTER TABLE `challenges` ADD `single_work_cap` int;--> statement-breakpoint
ALTER TABLE `challenges` ADD `rights_public_scope` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `rights_confidentiality` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `rights_ip` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `rights_enterprise_usage` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `rights_procurement` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `rights_special_terms` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `rights_exclusivity` text;--> statement-breakpoint
ALTER TABLE `season_projects` ADD `stage` varchar(16) DEFAULT 'seed' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_challenge_follows_user` ON `challenge_follows` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_challenge_versions_challenge` ON `challenge_versions` (`challenge_id`,`version`);