CREATE TABLE `rate_limit_counters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` varchar(64) NOT NULL,
	`key_hash` varchar(64) NOT NULL,
	`window_started_at` timestamp NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`expires_at` timestamp NOT NULL,
	CONSTRAINT `rate_limit_counters_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_rate_limit_scope_key_window` UNIQUE(`scope`,`key_hash`,`window_started_at`)
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limit_expires_at` ON `rate_limit_counters` (`expires_at`);