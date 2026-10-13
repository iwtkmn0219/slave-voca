CREATE TABLE `review_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`word_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`reviewed_at` integer NOT NULL,
	FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `words` ADD `due` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `words` ADD `stability` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `words` ADD `difficulty` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `words` ADD `elapsed_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `words` ADD `scheduled_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `words` ADD `learning_steps` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `words` ADD `reps` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `words` ADD `lapses` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `words` ADD `state` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `words` ADD `last_review` integer;--> statement-breakpoint
ALTER TABLE `words` ADD `introduced_at` integer;