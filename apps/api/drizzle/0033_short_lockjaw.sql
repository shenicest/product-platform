CREATE TABLE `announcement_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`announcement_id` int NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `announcement_recipients_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_announcement_recipients_announcement_user` UNIQUE(`announcement_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` varchar(16) NOT NULL,
	`type` varchar(32) NOT NULL,
	`level` varchar(16) NOT NULL DEFAULT 'info',
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`link_path` varchar(512),
	`season_id` int,
	`published_at` timestamp(3) NOT NULL DEFAULT (now()),
	`revoked_at` timestamp(3),
	`created_by` varchar(255) NOT NULL,
	`source_type` varchar(32),
	`source_id` varchar(64),
	`dedupe_key` varchar(191),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_announcements_dedupe` UNIQUE(`dedupe_key`)
);
--> statement-breakpoint
CREATE TABLE `user_announcement_reads` (
	`user_id` varchar(255) NOT NULL,
	`last_read_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `user_announcement_reads_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_announcement_recipients_user` ON `announcement_recipients` (`user_id`,`announcement_id`);--> statement-breakpoint
CREATE INDEX `idx_announcements_scope_published` ON `announcements` (`scope`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_announcements_published` ON `announcements` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_announcements_season_published` ON `announcements` (`season_id`,`published_at`);