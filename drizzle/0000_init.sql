CREATE TABLE `crux_country` (
	`domain` text NOT NULL,
	`country` text NOT NULL,
	`rank` integer NOT NULL,
	PRIMARY KEY(`domain`, `country`)
);
--> statement-breakpoint
CREATE TABLE `ground_truth` (
	`domain` text PRIMARY KEY NOT NULL,
	`monthly_visits` integer NOT NULL,
	`source` text NOT NULL,
	`period` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ip2asn` (
	`start` integer PRIMARY KEY NOT NULL,
	`end` integer NOT NULL,
	`asn` integer NOT NULL,
	`country` text,
	`org` text
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `ranks` (
	`source` text NOT NULL,
	`domain` text NOT NULL,
	`rank` integer NOT NULL,
	`extra` text,
	PRIMARY KEY(`source`, `domain`)
);
--> statement-breakpoint
CREATE INDEX `ranks_domain_idx` ON `ranks` (`domain`);--> statement-breakpoint
CREATE TABLE `reports` (
	`domain` text PRIMARY KEY NOT NULL,
	`json` text NOT NULL,
	`scanned_at` integer NOT NULL,
	`fetch_ok` integer DEFAULT false NOT NULL,
	`has_traffic` integer DEFAULT false NOT NULL,
	`tech_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reports_scanned_at_idx` ON `reports` (`scanned_at`);--> statement-breakpoint
CREATE TABLE `tech_history` (
	`domain` text NOT NULL,
	`tech` text NOT NULL,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL,
	PRIMARY KEY(`domain`, `tech`)
);
