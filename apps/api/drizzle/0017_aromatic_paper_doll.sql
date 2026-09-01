CREATE TABLE `hackathon_project_likes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hackathon_project_id` int NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `hackathon_project_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_hackathon_likes_project_user` UNIQUE(`hackathon_project_id`,`user_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_hackathon_likes_user_id` ON `hackathon_project_likes` (`user_id`);