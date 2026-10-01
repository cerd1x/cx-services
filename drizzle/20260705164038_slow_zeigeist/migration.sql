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
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	CONSTRAINT `fk_asset_mutation_asset_id_asset_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_asset_mutation_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
