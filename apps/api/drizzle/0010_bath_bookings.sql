CREATE TABLE `bath_bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`date` varchar(10) NOT NULL,
	`time_slot` varchar(5) NOT NULL,
	`gender` varchar(10) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bath_bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_bath_bookings_date_slot_gender` UNIQUE(`date`,`time_slot`,`gender`)
);
--> statement-breakpoint
CREATE INDEX `idx_bath_bookings_user_date` ON `bath_bookings` (`user_id`,`date`);