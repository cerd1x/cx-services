CREATE TABLE `outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`correlation_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`processed` integer DEFAULT false,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
