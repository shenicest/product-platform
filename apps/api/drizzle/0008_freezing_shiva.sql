ALTER TABLE `connection_requests` ADD `pair_key` varchar(511);--> statement-breakpoint
ALTER TABLE `connection_requests` ADD CONSTRAINT `uq_connection_requests_active_pair` UNIQUE(`pair_key`);