CREATE TABLE `challenge_resources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`challenge_id` int NOT NULL,
	`kind` varchar(24) NOT NULL,
	`title` varchar(255) NOT NULL,
	`quantity` varchar(100),
	`conditions` text,
	`owner` varchar(255),
	`status` varchar(16) NOT NULL DEFAULT 'committed',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `challenge_resources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `season_enterprise_cooperations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`season_id` int NOT NULL,
	`enterprise_name` varchar(255) NOT NULL,
	`tier` varchar(24) NOT NULL,
	`grade` varchar(16),
	`total_amount` int NOT NULL DEFAULT 0,
	`management_fee` int NOT NULL DEFAULT 0,
	`prize_pool_amount` int NOT NULL DEFAULT 0,
	`data_grant` text,
	`public_scope` varchar(16) NOT NULL DEFAULT 'anonymous',
	`status` varchar(16) NOT NULL DEFAULT 'intent',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `season_enterprise_cooperations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `challenges` ADD `type` varchar(32);--> statement-breakpoint
ALTER TABLE `challenges` ADD `theme` varchar(50);--> statement-breakpoint
ALTER TABLE `challenges` ADD `capacity` int;--> statement-breakpoint
CREATE INDEX `idx_challenge_resources_challenge_order` ON `challenge_resources` (`challenge_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_season_cooperations_season_order` ON `season_enterprise_cooperations` (`season_id`,`sort_order`);