CREATE TABLE `platform_meta` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `platform_meta_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_meta_key_unique` UNIQUE(`key`)
);
