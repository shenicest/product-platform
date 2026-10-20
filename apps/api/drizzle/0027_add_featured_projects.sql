CREATE TABLE `featured_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `featured_projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_featured_projects_project_id` UNIQUE(`project_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_featured_projects_sort_order` ON `featured_projects` (`sort_order`);