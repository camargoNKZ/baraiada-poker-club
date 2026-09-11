CREATE TABLE `financial_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`kind` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_amount` integer NOT NULL,
	`total_amount` integer NOT NULL,
	`payment_method` text NOT NULL,
	`note` text NOT NULL,
	`created_at` integer NOT NULL,
	`voided_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_financial_transactions_player_id` ON `financial_transactions` (`player_id`);--> statement-breakpoint
CREATE INDEX `idx_financial_transactions_kind` ON `financial_transactions` (`kind`);