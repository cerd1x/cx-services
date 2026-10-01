PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_token` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL UNIQUE,
	`session_token` text,
	`refresh_token` text,
	`expires_at` text NOT NULL,
	`type` text DEFAULT 'session' NOT NULL,
	CONSTRAINT `fk_token_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_token`(`id`, `user_id`, `session_token`, `refresh_token`, `expires_at`, `type`) SELECT `id`, `user_id`, `session_token`, `refresh_token`, `expires_at`, `type` FROM `token`;--> statement-breakpoint
DROP TABLE `token`;--> statement-breakpoint
ALTER TABLE `__new_token` RENAME TO `token`;--> statement-breakpoint
PRAGMA foreign_keys=ON;