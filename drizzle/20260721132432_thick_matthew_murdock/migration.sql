CREATE TABLE `order` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_method` text DEFAULT 'cash' NOT NULL,
	`total_amount` real NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`item_count` integer NOT NULL,
	`description` text,
	`customer_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_order_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transaction` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_method` text DEFAULT '{"type":"cash"}' NOT NULL,
	`customer_id` integer,
	`amount` text NOT NULL,
	`capital` text NOT NULL,
	`description` text,
	`category` text,
	`date` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_transaction_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_transaction`(`id`, `user_id`, `type`, `status`, `payment_method`, `customer_id`, `amount`, `capital`, `description`, `category`, `date`, `created_at`, `updated_at`) SELECT `id`, `user_id`, `type`, `status`, `payment_method`, `customer_id`, `amount`, `capital`, `description`, `category`, `date`, `created_at`, `updated_at` FROM `transaction`;--> statement-breakpoint
DROP TABLE `transaction`;--> statement-breakpoint
ALTER TABLE `__new_transaction` RENAME TO `transaction`;--> statement-breakpoint
PRAGMA foreign_keys=ON;