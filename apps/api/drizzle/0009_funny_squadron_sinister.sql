CREATE TABLE `connection_daily_limits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sender_user_id` varchar(255) NOT NULL,
	`beijing_date` varchar(10) NOT NULL,
	`successful_count` int NOT NULL DEFAULT 0,
	CONSTRAINT `connection_daily_limits_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_connection_daily_sender_date` UNIQUE(`sender_user_id`,`beijing_date`)
);
