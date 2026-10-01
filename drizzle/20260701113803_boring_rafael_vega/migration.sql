PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_asset` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`balance` text NOT NULL,
	`currency` text(4) NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	CONSTRAINT `fk_asset_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_asset`(`id`, `user_id`, `name`, `type`, `balance`, `currency`, `created_at`) SELECT `id`, `user_id`, `name`, `type`, `balance`, `currency`, `created_at` FROM `asset`;--> statement-breakpoint
DROP TABLE `asset`;--> statement-breakpoint
ALTER TABLE `__new_asset` RENAME TO `asset`;--> statement-breakpoint
PRAGMA foreign_keys=ON;