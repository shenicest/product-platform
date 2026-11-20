ALTER TABLE `projects` ADD `source_name` varchar(255);--> statement-breakpoint
ALTER TABLE `projects` ADD `external_id` varchar(255);--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `uq_projects_source_external` UNIQUE(`source_name`,`external_id`);