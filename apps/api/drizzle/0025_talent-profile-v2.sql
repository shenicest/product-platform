ALTER TABLE `talent_profiles` DROP COLUMN `roles`;--> statement-breakpoint
ALTER TABLE `talent_profiles` MODIFY COLUMN `bio` text;--> statement-breakpoint
ALTER TABLE `talent_profiles` ADD `links` json NOT NULL;--> statement-breakpoint
ALTER TABLE `talent_profiles` ADD `availability` tinyint NOT NULL;
