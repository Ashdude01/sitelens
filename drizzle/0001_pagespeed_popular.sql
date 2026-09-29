CREATE TABLE `pagespeed` (
	`domain` text NOT NULL,
	`strategy` text NOT NULL,
	`json` text NOT NULL,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`domain`, `strategy`)
);
--> statement-breakpoint
ALTER TABLE `reports` ADD `traffic_mid` integer;--> statement-breakpoint
CREATE INDEX `reports_traffic_mid_idx` ON `reports` (`traffic_mid`);
--> statement-breakpoint
UPDATE `reports` SET `traffic_mid` = CAST(COALESCE(json_extract(`json`, '$.traffic.verified.monthlyVisits'), json_extract(`json`, '$.traffic.estimate.monthlyVisits.mid')) AS INTEGER);
