-- M6-2: 문서·단어·아는 단어·설정에 주인(user_id)을 붙인다. 손으로 쓴 마이그레이션이다(drizzle-kit이 만든 SQL은
-- 기존 행에 넣을 user_id가 없어 실패한다). 기존 데이터는 임시 소유자 legacy-owner에게 묶고, 계정 주인이
-- npm run db:claim -- <이메일>로 가져간다. 데이터가 하나도 없으면 legacy-owner를 만들지 않는다.
-- 표를 새로 만들 때 연결된 행(후보·용례·복습 기록)이 지워지지 않도록 client.ts가 외래 키를 끈 채 이 파일을 실행하고,
-- 끝난 뒤 foreign_key_check로 확인한다.
INSERT INTO `users` (`id`, `name`, `email`, `status`, `role`)
SELECT 'legacy-owner', '이전 데이터', 'legacy-owner@localhost', 'blocked', 'user'
WHERE EXISTS (SELECT 1 FROM `documents`) OR EXISTS (SELECT 1 FROM `words`)
   OR EXISTS (SELECT 1 FROM `known_words`) OR EXISTS (SELECT 1 FROM `settings`);
--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'extracting' NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_documents` (`id`, `user_id`, `title`, `kind`, `status`, `error_message`, `created_at`)
SELECT `id`, 'legacy-owner', `title`, `kind`, `status`, `error_message`, `created_at` FROM `documents`;
--> statement-breakpoint
DROP TABLE `documents`;
--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;
--> statement-breakpoint
CREATE INDEX `documents_user_id_idx` ON `documents` (`user_id`);
--> statement-breakpoint
CREATE TABLE `__new_words` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`lemma` text NOT NULL,
	`phonetic` text,
	`created_at` integer NOT NULL,
	`due` integer DEFAULT 0 NOT NULL,
	`stability` real DEFAULT 0 NOT NULL,
	`difficulty` real DEFAULT 0 NOT NULL,
	`elapsed_days` integer DEFAULT 0 NOT NULL,
	`scheduled_days` integer DEFAULT 0 NOT NULL,
	`learning_steps` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`state` integer DEFAULT 0 NOT NULL,
	`last_review` integer,
	`introduced_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_words` (`id`, `user_id`, `lemma`, `phonetic`, `created_at`, `due`, `stability`, `difficulty`,
  `elapsed_days`, `scheduled_days`, `learning_steps`, `reps`, `lapses`, `state`, `last_review`, `introduced_at`)
SELECT `id`, 'legacy-owner', `lemma`, `phonetic`, `created_at`, `due`, `stability`, `difficulty`,
  `elapsed_days`, `scheduled_days`, `learning_steps`, `reps`, `lapses`, `state`, `last_review`, `introduced_at` FROM `words`;
--> statement-breakpoint
DROP TABLE `words`;
--> statement-breakpoint
ALTER TABLE `__new_words` RENAME TO `words`;
--> statement-breakpoint
CREATE UNIQUE INDEX `words_user_id_lemma_unique` ON `words` (`user_id`,`lemma`);
--> statement-breakpoint
CREATE TABLE `__new_known_words` (
	`user_id` text NOT NULL,
	`lemma` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `lemma`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_known_words` (`user_id`, `lemma`, `created_at`) SELECT 'legacy-owner', `lemma`, `created_at` FROM `known_words`;
--> statement-breakpoint
DROP TABLE `known_words`;
--> statement-breakpoint
ALTER TABLE `__new_known_words` RENAME TO `known_words`;
--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`user_id`, `key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_settings` (`user_id`, `key`, `value`) SELECT 'legacy-owner', `key`, `value` FROM `settings`;
--> statement-breakpoint
DROP TABLE `settings`;
--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;
