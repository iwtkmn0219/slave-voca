CREATE TABLE `candidates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` integer NOT NULL,
	`lemma` text NOT NULL,
	`surface` text NOT NULL,
	`sentence` text NOT NULL,
	`count` integer NOT NULL,
	`is_existing` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'extracting' NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `known_words` (
	`lemma` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `words` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lemma` text NOT NULL,
	`phonetic` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `words_lemma_unique` ON `words` (`lemma`);