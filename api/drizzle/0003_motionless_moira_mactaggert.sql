CREATE TABLE "trust_designation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"designation_id" uuid NOT NULL,
	"maintainer_id" uuid NOT NULL,
	"kind" "designation_event_kind" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trust_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_channel_id" varchar(24) NOT NULL,
	"rationale" text NOT NULL,
	"representative_video_url" text NOT NULL,
	"rate_limit_key" varchar(64) NOT NULL,
	"status" "evidence_submission_status" DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_maintainer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trusted_designations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"status" "designation_status" DEFAULT 'active' NOT NULL,
	"rationale" text NOT NULL,
	"representative_video_url" text NOT NULL,
	"created_by_maintainer_id" uuid NOT NULL,
	"updated_by_maintainer_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trusted_designations_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
ALTER TABLE "trust_designation_events" ADD CONSTRAINT "trust_designation_events_designation_id_trusted_designations_id_fk" FOREIGN KEY ("designation_id") REFERENCES "public"."trusted_designations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_designation_events" ADD CONSTRAINT "trust_designation_events_maintainer_id_maintainers_id_fk" FOREIGN KEY ("maintainer_id") REFERENCES "public"."maintainers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_submissions" ADD CONSTRAINT "trust_submissions_reviewed_by_maintainer_id_maintainers_id_fk" FOREIGN KEY ("reviewed_by_maintainer_id") REFERENCES "public"."maintainers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_designations" ADD CONSTRAINT "trusted_designations_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_designations" ADD CONSTRAINT "trusted_designations_created_by_maintainer_id_maintainers_id_fk" FOREIGN KEY ("created_by_maintainer_id") REFERENCES "public"."maintainers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_designations" ADD CONSTRAINT "trusted_designations_updated_by_maintainer_id_maintainers_id_fk" FOREIGN KEY ("updated_by_maintainer_id") REFERENCES "public"."maintainers"("id") ON DELETE no action ON UPDATE no action;