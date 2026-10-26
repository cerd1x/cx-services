PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_setting` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL UNIQUE,
	`currency` text(4) DEFAULT 'IDR' NOT NULL,
	`dark_mode` integer DEFAULT false NOT NULL,
	`date_format` text(30) DEFAULT 'd MMM yyyy, HH:mm' NOT NULL,
	`default_asset_cash_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_setting_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_setting_default_asset_cash_id_asset_id_fk` FOREIGN KEY (`default_asset_cash_id`) REFERENCES `asset`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
-- Konversi timestamp lama (text CURRENT_TIMESTAMP / ISO string) ke epoch detik.
INSERT INTO `__new_setting`(`id`, `user_id`, `currency`, `dark_mode`, `date_format`, `default_asset_cash_id`, `created_at`, `updated_at`) SELECT `id`, `user_id`, `currency`, `dark_mode`, `date_format`, `default_asset_cash_id`, CASE WHEN trim(`created_at`) NOT GLOB '*[^0-9]*' THEN CAST(`created_at` AS INTEGER) ELSE COALESCE(CAST(strftime('%s', `created_at`) AS INTEGER), unixepoch()) END, CASE WHEN trim(`updated_at`) NOT GLOB '*[^0-9]*' THEN CAST(`updated_at` AS INTEGER) ELSE COALESCE(CAST(strftime('%s', `updated_at`) AS INTEGER), unixepoch()) END FROM `setting`;--> statement-breakpoint
DROP TABLE `setting`;--> statement-breakpoint
ALTER TABLE `__new_setting` RENAME TO `setting`;--> statement-breakpoint
PRAGMA foreign_keys=ON;