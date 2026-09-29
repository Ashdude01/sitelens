CREATE TABLE "latency" (
	"domain" text PRIMARY KEY NOT NULL,
	"json" text NOT NULL,
	"fetched_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "previews" (
	"domain" text PRIMARY KEY NOT NULL,
	"image" text NOT NULL,
	"content_type" text NOT NULL,
	"fetched_at" bigint NOT NULL
);
