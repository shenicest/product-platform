CREATE TABLE `connection_notification_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connection_request_id` int NOT NULL,
	`notification_type` varchar(64) NOT NULL,
	`recipient_email` varchar(254) NOT NULL,
	`status` varchar(32) NOT NULL,
	`attempt_count` int NOT NULL DEFAULT 0,
	`provider_message_id` varchar(255),
	`last_error_code` varchar(128),
	`last_attempt_at` timestamp,
	`sent_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `connection_notification_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_connection_notification_deliveries_request_type` UNIQUE(`connection_request_id`,`notification_type`)
);
--> statement-breakpoint
CREATE TABLE `hackathon_connection_daily_limits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sender_user_id` varchar(255) NOT NULL,
	`beijing_date` varchar(10) NOT NULL,
	`successful_count` int NOT NULL DEFAULT 0,
	CONSTRAINT `hackathon_connection_daily_limits_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_hackathon_connection_daily_sender_date` UNIQUE(`sender_user_id`,`beijing_date`)
);
--> statement-breakpoint
CREATE TABLE `hackathon_connection_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_id` int NOT NULL,
	`hackathon_project_id` int NOT NULL,
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
	CONSTRAINT `hackathon_connection_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_hackathon_connection_requests_active_pair` UNIQUE(`pair_key`)
);
--> statement-breakpoint
CREATE TABLE `hackathon_project_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_id` int NOT NULL,
	`hackathon_project_id` int NOT NULL,
	`receiver_user_id` varchar(255) NOT NULL,
	`notification_email` varchar(254) NOT NULL,
	`display_name` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hackathon_project_contacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_hackathon_contacts_event_project` UNIQUE(`event_id`,`hackathon_project_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_hackathon_connection_requests_sender` ON `hackathon_connection_requests` (`sender_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_hackathon_connection_requests_receiver_status` ON `hackathon_connection_requests` (`receiver_user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_hackathon_connection_requests_project_status` ON `hackathon_connection_requests` (`event_id`,`hackathon_project_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_hackathon_connection_requests_sender_project_status` ON `hackathon_connection_requests` (`sender_user_id`,`hackathon_project_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_hackathon_contacts_receiver` ON `hackathon_project_contacts` (`receiver_user_id`);