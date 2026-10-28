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
	CONSTRAINT "asset_mutation_type_check" CHECK("type" in ('CR', 'DB', 'TF', 'EB', 'ADM'))
);
--> statement-breakpoint
INSERT INTO `__new_asset_mutation`(`id`, `asset_id`, `user_id`, `type`, `amount`, `currency`, `balance_before`, `balance_after`, `description`, `created_at`)
SELECT `id`, `asset_id`, `user_id`,
	CASE `type`
		WHEN 'add' THEN 'CR'
		WHEN 'subtract' THEN 'DB'
		WHEN 'swap' THEN 'TF'
		WHEN 'transaction' THEN 'EB'
		ELSE `type`
	END,
	`amount`, `currency`, `balance_before`, `balance_after`, `description`, `created_at`
FROM `asset_mutation`;--> statement-breakpoint
DROP TABLE `asset_mutation`;--> statement-breakpoint
ALTER TABLE `__new_asset_mutation` RENAME TO `asset_mutation`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
