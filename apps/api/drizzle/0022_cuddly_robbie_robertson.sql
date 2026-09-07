ALTER TABLE `connection_daily_limits` ADD `scope` varchar(64) NOT NULL DEFAULT 'talent_connection';--> statement-breakpoint
ALTER TABLE `connection_daily_limits` DROP INDEX `uq_connection_daily_sender_date`;--> statement-breakpoint
ALTER TABLE `connection_daily_limits` ADD CONSTRAINT `uq_connection_daily_scope_sender_date` UNIQUE(`scope`,`sender_user_id`,`beijing_date`);--> statement-breakpoint
INSERT INTO `connection_daily_limits` (`scope`,`sender_user_id`,`beijing_date`,`successful_count`) SELECT 'hackathon_connection',`sender_user_id`,`beijing_date`,`successful_count` FROM `hackathon_connection_daily_limits`;--> statement-breakpoint
ALTER TABLE `connection_daily_limits` ALTER COLUMN `scope` DROP DEFAULT;--> statement-breakpoint
DROP TABLE `hackathon_connection_daily_limits`;
