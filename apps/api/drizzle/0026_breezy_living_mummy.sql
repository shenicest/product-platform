CREATE TABLE `project_connection_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`receiver_user_id` varchar(255) NOT NULL,
	`sender_user_id` varchar(255) NOT NULL,
	`purpose` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`sender_contact` text NOT NULL,
	`receiver_contact` text,
	`status` tinyint NOT NULL,
	`pair_key` varchar(511),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`accepted_at` timestamp,
	`handled_at` timestamp,
	CONSTRAINT `project_connection_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_project_connection_requests_active_pair` UNIQUE(`pair_key`)
);
--> statement-breakpoint
CREATE INDEX `idx_project_connection_requests_project_status` ON `project_connection_requests` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_project_connection_requests_sender_project_status` ON `project_connection_requests` (`sender_user_id`,`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_project_connection_requests_receiver_status` ON `project_connection_requests` (`receiver_user_id`,`status`,`created_at`);