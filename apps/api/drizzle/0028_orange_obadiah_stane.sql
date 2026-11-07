CREATE TABLE `season_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`season_id` int NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`skills` text NOT NULL,
	`experience` text NOT NULL,
	`themes` json NOT NULL,
	`team_intent` text NOT NULL,
	`accepts_solo` boolean NOT NULL,
	`availability` text NOT NULL,
	`city_mode` text NOT NULL,
	`contact_encrypted` text NOT NULL,
	`visibility` varchar(16) NOT NULL DEFAULT 'organizer_only',
	`agreement_version` varchar(32) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'submitted',
	`reviewed_by` varchar(255),
	`review_reason` text,
	`reviewed_at` timestamp,
	`withdrawn_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `season_applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_season_applications_season_user` UNIQUE(`season_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `season_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`season_id` int NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`application_id` int NOT NULL,
	`wechat_status` varchar(16) NOT NULL DEFAULT 'not_invited',
	`wechat_invited_by` varchar(255),
	`wechat_invited_at` timestamp,
	`joined_at` timestamp,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`withdrawn_at` timestamp,
	`withdrawn_by` varchar(255),
	`withdraw_reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `season_participants_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_season_participants_season_user` UNIQUE(`season_id`,`user_id`),
	CONSTRAINT `uq_season_participants_application` UNIQUE(`application_id`)
);
--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`season_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`real_problem` text,
	`target_customer` text,
	`minimum_deliverable` text,
	`resource_commitment` text,
	`result_evidence_rules` text,
	`status` varchar(16) NOT NULL DEFAULT 'draft',
	`version` int NOT NULL DEFAULT 1,
	`created_by` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `challenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `point_allocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`season_id` int NOT NULL,
	`pool_id` int NOT NULL,
	`scorer_user_id` varchar(255) NOT NULL,
	`amount` int NOT NULL,
	`used_amount` int NOT NULL DEFAULT 0,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`created_by` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `point_allocations_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_point_allocations_season_scorer` UNIQUE(`season_id`,`scorer_user_id`)
);
--> statement-breakpoint
CREATE TABLE `season_budgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`season_id` int NOT NULL,
	`version` int NOT NULL,
	`total_amount` int NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`reason` varchar(255) NOT NULL,
	`created_by` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `season_budgets_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_season_budgets_season_version` UNIQUE(`season_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `season_point_pools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`season_id` int NOT NULL,
	`total_points` int NOT NULL DEFAULT 0,
	`allocated_points` int NOT NULL DEFAULT 0,
	`used_points` int NOT NULL DEFAULT 0,
	`version` int NOT NULL DEFAULT 1,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`created_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `season_point_pools_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_season_point_pools_season` UNIQUE(`season_id`)
);
--> statement-breakpoint
CREATE TABLE `season_verifier_grants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`season_id` int NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`granted_by` varchar(255) NOT NULL,
	`granted_at` timestamp NOT NULL DEFAULT (now()),
	`revoked_by` varchar(255),
	`revoked_at` timestamp,
	`revoke_reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `season_verifier_grants_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_season_verifier_grants_season_user` UNIQUE(`season_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `organizer_org_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizer_org_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_organizer_org_members_org_user` UNIQUE(`org_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `organizer_orgs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizer_orgs_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_organizer_orgs_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `season_organizers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`season_id` int NOT NULL,
	`org_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `season_organizers_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_season_organizers_season_org` UNIQUE(`season_id`,`org_id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_user_id` varchar(255) NOT NULL,
	`action` varchar(64) NOT NULL,
	`target_type` varchar(32) NOT NULL,
	`target_id` varchar(64) NOT NULL,
	`season_id` int,
	`detail` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `season_announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`season_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`category` varchar(16) NOT NULL DEFAULT 'general',
	`created_by` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `season_announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `season_rule_card_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`season_id` int NOT NULL,
	`key` varchar(64) NOT NULL,
	`label` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`required` boolean NOT NULL DEFAULT false,
	`visible` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `season_rule_card_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_season_rule_card_season_key` UNIQUE(`season_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` varchar(16) NOT NULL DEFAULT 'season',
	`city` varchar(100),
	`intro` text,
	`themes` json NOT NULL,
	`apply_open` timestamp,
	`apply_close` timestamp,
	`start_at` timestamp,
	`team_deadline` timestamp,
	`challenge_freeze_at` timestamp,
	`work_deadline` timestamp,
	`score_deadline` timestamp,
	`settle_date` timestamp,
	`status` varchar(16) NOT NULL DEFAULT 'draft',
	`approved_at` timestamp,
	`approved_by` varchar(255),
	`submitted_at` timestamp,
	`rejected_at` timestamp,
	`rejected_by` varchar(255),
	`rejection_reason` text,
	`started_at` timestamp,
	`suspended_at` timestamp,
	`status_before_suspend` varchar(16),
	`resumed_at` timestamp,
	`cancelled_at` timestamp,
	`cancel_reason` text,
	`pinned` boolean NOT NULL DEFAULT false,
	`participant_capacity` int,
	`awarding_entity` varchar(255),
	`agreement_version` varchar(32) NOT NULL DEFAULT 'v1',
	`rules_version` int NOT NULL DEFAULT 1,
	`rules` json NOT NULL,
	`created_by` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seasons_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_seasons_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE INDEX `idx_season_applications_season_status` ON `season_applications` (`season_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_season_applications_user` ON `season_applications` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_season_participants_season_wechat` ON `season_participants` (`season_id`,`wechat_status`);--> statement-breakpoint
CREATE INDEX `idx_season_participants_season_status` ON `season_participants` (`season_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_challenges_season_status` ON `challenges` (`season_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_point_allocations_season_status` ON `point_allocations` (`season_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_season_budgets_season_status` ON `season_budgets` (`season_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_season_verifier_grants_season_status` ON `season_verifier_grants` (`season_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_organizer_org_members_user` ON `organizer_org_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_season_organizers_org` ON `season_organizers` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_season_created` ON `audit_logs` (`season_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_actor` ON `audit_logs` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_action` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `idx_season_announcements_season_created` ON `season_announcements` (`season_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_season_rule_card_season_order` ON `season_rule_card_items` (`season_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_seasons_status_start` ON `seasons` (`status`,`start_at`);--> statement-breakpoint
CREATE INDEX `idx_seasons_pinned` ON `seasons` (`pinned`);--> statement-breakpoint
CREATE INDEX `idx_seasons_approved` ON `seasons` (`approved_at`);