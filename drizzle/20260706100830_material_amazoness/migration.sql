CREATE TABLE `asset_mutation` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`asset_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text(4) NOT NULL,
	`balance_before` text NOT NULL,
	`balance_after` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT `fk_asset_mutation_asset_id_asset_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_asset_mutation_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `product` RENAME COLUMN `price` TO `amount`;--> statement-breakpoint
ALTER TABLE `product` ADD `capital` real;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_asset` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`balance` real DEFAULT 0 NOT NULL,
	`currency` text(4) NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT `fk_asset_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_asset`(`id`, `user_id`, `name`, `type`, `balance`, `currency`, `created_at`) SELECT `id`, `user_id`, `name`, `type`, `balance`, `currency`, `created_at` FROM `asset`;--> statement-breakpoint
DROP TABLE `asset`;--> statement-breakpoint
ALTER TABLE `__new_asset` RENAME TO `asset`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_product` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer,
	`name` text NOT NULL,
	`description` text,
	`amount` real NOT NULL,
	`capital` real,
	`currency` text(3) NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text,
	CONSTRAINT `fk_product_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_product`(`id`, `user_id`, `name`, `description`, `amount`, `currency`, `stock`, `created_at`, `updated_at`) SELECT `id`, `user_id`, `name`, `description`, `amount`, `currency`, `stock`, `created_at`, `updated_at` FROM `product`;--> statement-breakpoint
DROP TABLE `product`;--> statement-breakpoint
ALTER TABLE `__new_product` RENAME TO `product`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_setting` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL UNIQUE,
	`currency` text(4) DEFAULT 'IDR' NOT NULL,
	`dark_mode` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT `fk_setting_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_setting`(`id`, `user_id`, `currency`, `dark_mode`, `created_at`, `updated_at`) SELECT `id`, `user_id`, `currency`, `dark_mode`, `created_at`, `updated_at` FROM `setting`;--> statement-breakpoint
DROP TABLE `setting`;--> statement-breakpoint
ALTER TABLE `__new_setting` RENAME TO `setting`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`username` text NOT NULL UNIQUE,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`avatar` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user`(`id`, `name`, `username`, `email`, `password`, `avatar`, `created_at`) SELECT `id`, `name`, `username`, `email`, `password`, `avatar`, `created_at` FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;