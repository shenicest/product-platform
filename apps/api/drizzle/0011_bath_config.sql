CREATE TABLE `bath_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_start` varchar(10) NOT NULL,
	`event_end` varchar(10) NOT NULL,
	`updated_by` varchar(255),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bath_config_id` PRIMARY KEY(`id`)
);
