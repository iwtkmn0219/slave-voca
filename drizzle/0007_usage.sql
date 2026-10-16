CREATE TABLE `alert_log` (
	`key` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meaning_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`source` text NOT NULL,
	`words` integer NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real NOT NULL,
	`settled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `meaning_usage_created_at_idx` ON `meaning_usage` (`created_at`);--> statement-breakpoint
CREATE INDEX `meaning_usage_user_id_created_at_idx` ON `meaning_usage` (`user_id`,`created_at`);