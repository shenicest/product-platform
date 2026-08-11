CREATE TABLE `follows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`follower_user_id` varchar(255) NOT NULL,
	`followee_user_id` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `follows_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_follows_follower_followee` UNIQUE(`follower_user_id`,`followee_user_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_follows_followee_user_id` ON `follows` (`followee_user_id`);