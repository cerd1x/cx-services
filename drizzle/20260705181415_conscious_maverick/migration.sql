ALTER TABLE `token` RENAME COLUMN `expires_at` TO `expired_at_session`;--> statement-breakpoint
ALTER TABLE `token` ADD `expired_at_refresh` text NOT NULL;--> statement-breakpoint
ALTER TABLE `token` DROP COLUMN `type`;