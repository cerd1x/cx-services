ALTER TABLE `order` ADD `product_id` integer REFERENCES product(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `order` ADD `payment_status` text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE `order` ADD `paid_amount` real DEFAULT 0 NOT NULL;