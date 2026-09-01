CREATE TABLE `hackathon_project_hidden` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_id` int NOT NULL,
	`hackathon_project_id` int NOT NULL,
	`hidden_by` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `hackathon_project_hidden_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_hackathon_hidden_event_project` UNIQUE(`event_id`,`hackathon_project_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_hackathon_hidden_project_id` ON `hackathon_project_hidden` (`hackathon_project_id`);