CREATE TABLE `api_killswitch` (
	`operation` text PRIMARY KEY,
	`reason` text,
	`disabled_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `api_killswitch_disabled_at_idx` ON `api_killswitch` (`disabled_at`);