CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`entries` integer NOT NULL,
	`reentries` integer NOT NULL,
	`addons` integer NOT NULL,
	`chips` integer NOT NULL,
	`table_no` text NOT NULL,
	`eliminated_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`entry_value` integer NOT NULL,
	`reentry_value` integer NOT NULL,
	`addon_value` integer NOT NULL,
	`payout_places` integer NOT NULL,
	`level_minutes` integer NOT NULL,
	`small_blind` integer NOT NULL,
	`big_blind` integer NOT NULL,
	`ante` integer NOT NULL,
	`timer_started_at` integer,
	`timer_paused_seconds` integer NOT NULL,
	`updated_at` integer NOT NULL
);
