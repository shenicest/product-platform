CREATE TABLE `hackathon_project_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_id` int NOT NULL,
	`hackathon_project_id` int NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`tag_id` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `hackathon_project_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_hackathon_tag_project_user` UNIQUE(`event_id`,`hackathon_project_id`,`user_id`,`tag_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_hackathon_tags_project` ON `hackathon_project_tags` (`event_id`,`hackathon_project_id`);--> statement-breakpoint
CREATE INDEX `idx_hackathon_tags_user` ON `hackathon_project_tags` (`user_id`);