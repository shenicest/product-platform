CREATE TABLE `user_identities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`role` tinyint NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_user_role` UNIQUE(`user_id`,`role`)
);
