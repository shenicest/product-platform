CREATE TABLE `project_likes` (
	`project_id` int NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `uq_project_likes_project_user` UNIQUE(`project_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `projects` ADD `like_count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_project_likes_user_id` ON `project_likes` (`user_id`);