CREATE TABLE "crux_country" (
	"domain" text NOT NULL,
	"country" text NOT NULL,
	"rank" integer NOT NULL,
	CONSTRAINT "crux_country_domain_country_pk" PRIMARY KEY("domain","country")
);
--> statement-breakpoint
CREATE TABLE "ground_truth" (
	"domain" text PRIMARY KEY NOT NULL,
	"monthly_visits" bigint NOT NULL,
	"source" text NOT NULL,
	"period" text,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ip2asn" (
	"start" bigint PRIMARY KEY NOT NULL,
	"end" bigint NOT NULL,
	"asn" integer NOT NULL,
	"country" text,
	"org" text
);
--> statement-breakpoint
CREATE TABLE "meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "pagespeed" (
	"domain" text NOT NULL,
	"strategy" text NOT NULL,
	"json" text NOT NULL,
	"fetched_at" bigint NOT NULL,
	CONSTRAINT "pagespeed_domain_strategy_pk" PRIMARY KEY("domain","strategy")
);
--> statement-breakpoint
CREATE TABLE "ranks" (
	"source" text NOT NULL,
	"domain" text NOT NULL,
	"rank" integer NOT NULL,
	"extra" text,
	CONSTRAINT "ranks_source_domain_pk" PRIMARY KEY("source","domain")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"domain" text PRIMARY KEY NOT NULL,
	"json" text NOT NULL,
	"scanned_at" bigint NOT NULL,
	"fetch_ok" boolean DEFAULT false NOT NULL,
	"has_traffic" boolean DEFAULT false NOT NULL,
	"tech_count" integer DEFAULT 0 NOT NULL,
	"traffic_mid" bigint
);
--> statement-breakpoint
CREATE TABLE "tech_history" (
	"domain" text NOT NULL,
	"tech" text NOT NULL,
	"first_seen" bigint NOT NULL,
	"last_seen" bigint NOT NULL,
	CONSTRAINT "tech_history_domain_tech_pk" PRIMARY KEY("domain","tech")
);
--> statement-breakpoint
CREATE INDEX "ranks_domain_idx" ON "ranks" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "reports_scanned_at_idx" ON "reports" USING btree ("scanned_at");--> statement-breakpoint
CREATE INDEX "reports_traffic_mid_idx" ON "reports" USING btree ("traffic_mid");