PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_asset_mutation` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`asset_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text(4) NOT NULL,
	`balance_before` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_asset_mutation_asset_id_asset_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_asset_mutation_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "asset_mutation_type_check" CHECK("type" in ('add', 'subtract', 'transaction', 'swap'))
);
--> statement-breakpoint
INSERT INTO `__new_asset_mutation`(`id`, `asset_id`, `user_id`, `type`, `amount`, `currency`, `balance_before`, `balance_after`, `description`, `created_at`) SELECT `id`, `asset_id`, `user_id`, `type`, `amount`, `currency`, `balance_before`, `balance_after`, `description`, CAST(strftime('%s', `created_at`) AS INTEGER) FROM `asset_mutation`;--> statement-breakpoint
DROP TABLE `asset_mutation`;--> statement-breakpoint
ALTER TABLE `__new_asset_mutation` RENAME TO `asset_mutation`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_asset` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`currency` text(4) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_asset_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "asset_type_check" CHECK("type" in ('bank', 'ewallet', 'cash', 'loan', 'crypto'))
);
--> statement-breakpoint
INSERT INTO `__new_asset`(`id`, `user_id`, `name`, `type`, `balance`, `currency`, `created_at`) SELECT `id`, `user_id`, `name`, `type`, `balance`, `currency`, CAST(strftime('%s', `created_at`) AS INTEGER) FROM `asset`;--> statement-breakpoint
DROP TABLE `asset`;--> statement-breakpoint
ALTER TABLE `__new_asset` RENAME TO `asset`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_contact` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`group` text,
	`avatar` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	CONSTRAINT `fk_contact_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_contact`(`id`, `user_id`, `name`, `email`, `phone`, `group`, `avatar`, `created_at`, `updated_at`) SELECT `id`, `user_id`, `name`, `email`, `phone`, `group`, `avatar`, CAST(strftime('%s', `created_at`) AS INTEGER), CAST(strftime('%s', `updated_at`) AS INTEGER) FROM `contact`;--> statement-breakpoint
DROP TABLE `contact`;--> statement-breakpoint
ALTER TABLE `__new_contact` RENAME TO `contact`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_gemini_oauth_token` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL UNIQUE,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`scope` text,
	`token_type` text DEFAULT 'Bearer',
	`expires_at` integer NOT NULL,
	`project_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_gemini_oauth_token_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_gemini_oauth_token`(`id`, `user_id`, `access_token`, `refresh_token`, `scope`, `token_type`, `expires_at`, `project_id`, `created_at`, `updated_at`) SELECT `id`, `user_id`, `access_token`, `refresh_token`, `scope`, `token_type`, `expires_at`, `project_id`, CAST(strftime('%s', `created_at`) AS INTEGER), CAST(strftime('%s', `updated_at`) AS INTEGER) FROM `gemini_oauth_token`;--> statement-breakpoint
DROP TABLE `gemini_oauth_token`;--> statement-breakpoint
ALTER TABLE `__new_gemini_oauth_token` RENAME TO `gemini_oauth_token`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`correlation_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`processed` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_outbox`(`id`, `correlation_id`, `event_type`, `payload`, `processed`, `created_at`) SELECT `id`, `correlation_id`, `event_type`, `payload`, `processed`, CAST(strftime('%s', `created_at`) AS INTEGER) FROM `outbox`;--> statement-breakpoint
DROP TABLE `outbox`;--> statement-breakpoint
ALTER TABLE `__new_outbox` RENAME TO `outbox`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_passkey` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`credential_id` text NOT NULL UNIQUE,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text,
	`device_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_passkey_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_passkey`(`id`, `user_id`, `credential_id`, `public_key`, `counter`, `transports`, `device_name`, `created_at`) SELECT `id`, `user_id`, `credential_id`, `public_key`, `counter`, `transports`, `device_name`, CAST(strftime('%s', `created_at`) AS INTEGER) FROM `passkey`;--> statement-breakpoint
DROP TABLE `passkey`;--> statement-breakpoint
ALTER TABLE `__new_passkey` RENAME TO `passkey`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_product` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` real NOT NULL,
	`capital` real,
	`currency` text(3) NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`track_stock` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	CONSTRAINT `fk_product_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_product`(`id`, `user_id`, `name`, `description`, `price`, `capital`, `currency`, `stock`, `track_stock`, `created_at`, `updated_at`) SELECT `id`, `user_id`, `name`, `description`, `price`, `capital`, `currency`, `stock`, `track_stock`, CAST(strftime('%s', `created_at`) AS INTEGER), CAST(strftime('%s', `updated_at`) AS INTEGER) FROM `product`;--> statement-breakpoint
DROP TABLE `product`;--> statement-breakpoint
ALTER TABLE `__new_product` RENAME TO `product`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_token` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL UNIQUE,
	`session_token` text,
	`refresh_token` text,
	`expired_at_session` integer NOT NULL,
	`expired_at_refresh` integer NOT NULL,
	CONSTRAINT `fk_token_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_token`(`id`, `user_id`, `session_token`, `refresh_token`, `expired_at_session`, `expired_at_refresh`) SELECT `id`, `user_id`, `session_token`, `refresh_token`, CAST(strftime('%s', `expired_at_session`) AS INTEGER), CAST(strftime('%s', `expired_at_refresh`) AS INTEGER) FROM `token`;--> statement-breakpoint
DROP TABLE `token`;--> statement-breakpoint
ALTER TABLE `__new_token` RENAME TO `token`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`username` text NOT NULL UNIQUE,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`avatar` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user`(`id`, `name`, `username`, `email`, `password`, `avatar`, `role`, `created_at`) SELECT `id`, `name`, `username`, `email`, `password`, `avatar`, `role`, CAST(strftime('%s', `created_at`) AS INTEGER) FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `contact_user_id_id_idx` ON `contact` (`user_id`,`id`);