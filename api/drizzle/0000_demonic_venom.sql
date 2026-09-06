CREATE TYPE "public"."designation_event_kind" AS ENUM('published', 'revised', 'removed');--> statement-breakpoint
CREATE TYPE "public"."designation_status" AS ENUM('active', 'removed');--> statement-breakpoint
CREATE TYPE "public"."evidence_submission_status" AS ENUM('pending', 'reviewed', 'dismissed');--> statement-breakpoint
CREATE TABLE "catalogue_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_designations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"status" "designation_status" DEFAULT 'active' NOT NULL,
	"rationale" text NOT NULL,
	"representative_video_url" text NOT NULL,
	"created_by_maintainer_id" uuid NOT NULL,
	"updated_by_maintainer_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_designations_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_channel_id" varchar(24) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_youtube_channel_id_unique" UNIQUE("youtube_channel_id")
);
--> statement-breakpoint
CREATE TABLE "designation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"designation_id" uuid NOT NULL,
	"maintainer_id" uuid NOT NULL,
	"kind" "designation_event_kind" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_channel_id" varchar(24) NOT NULL,
	"rationale" text NOT NULL,
	"representative_video_url" text NOT NULL,
	"rate_limit_key" varchar(64) NOT NULL,
	"status" "evidence_submission_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintainers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_user_id" varchar(32) NOT NULL,
	"github_login" varchar(255) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintainers_github_user_id_unique" UNIQUE("github_user_id")
);
--> statement-breakpoint
ALTER TABLE "channel_designations" ADD CONSTRAINT "channel_designations_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_designations" ADD CONSTRAINT "channel_designations_created_by_maintainer_id_maintainers_id_fk" FOREIGN KEY ("created_by_maintainer_id") REFERENCES "public"."maintainers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_designations" ADD CONSTRAINT "channel_designations_updated_by_maintainer_id_maintainers_id_fk" FOREIGN KEY ("updated_by_maintainer_id") REFERENCES "public"."maintainers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designation_events" ADD CONSTRAINT "designation_events_designation_id_channel_designations_id_fk" FOREIGN KEY ("designation_id") REFERENCES "public"."channel_designations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designation_events" ADD CONSTRAINT "designation_events_maintainer_id_maintainers_id_fk" FOREIGN KEY ("maintainer_id") REFERENCES "public"."maintainers"("id") ON DELETE no action ON UPDATE no action;