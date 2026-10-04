-- Additive-only: hanya CREATE TABLE baru. Tidak ada DROP/ALTER data existing.
CREATE TABLE IF NOT EXISTS `invoice` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`invoice_number` text NOT NULL UNIQUE,
	`customer_id` integer,
	`items` text NOT NULL,
	`subtotal` real NOT NULL,
	`tax` real DEFAULT 0 NOT NULL,
	`total_amount` real NOT NULL,
	`currency` text(3) NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`issued_at` integer,
	`due_at` integer,
	`paid_at` integer,
	`description` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_invoice_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_invoice_customer_id_contact_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `contact`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `payment` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`invoice_id` integer,
	`amount` real NOT NULL,
	`currency` text(3) NOT NULL,
	`method` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`gateway_ref` text,
	`description` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_payment_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_payment_invoice_id_invoice_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoice`(`id`) ON DELETE SET NULL
);
