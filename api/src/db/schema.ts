import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const designationStatus = pgEnum("designation_status", [
  "active",
  "removed",
]);

export const designationEventKind = pgEnum("designation_event_kind", [
  "published",
  "revised",
  "removed",
]);

export const evidenceSubmissionStatus = pgEnum("evidence_submission_status", [
  "pending",
  "reviewed",
  "dismissed",
]);

export const maintainers = pgTable("maintainers", {
  id: uuid("id").defaultRandom().primaryKey(),
  githubUserId: varchar("github_user_id", { length: 32 }).notNull().unique(),
  githubLogin: varchar("github_login", { length: 255 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const channels = pgTable("channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  youtubeChannelId: varchar("youtube_channel_id", { length: 24 })
    .notNull()
    .unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const channelDesignations = pgTable("channel_designations", {
  id: uuid("id").defaultRandom().primaryKey(),
  channelId: uuid("channel_id")
    .notNull()
    .unique()
    .references(() => channels.id),
  status: designationStatus("status").default("active").notNull(),
  rationale: text("rationale").notNull(),
  representativeVideoUrl: text("representative_video_url").notNull(),
  createdByMaintainerId: uuid("created_by_maintainer_id")
    .notNull()
    .references(() => maintainers.id),
  updatedByMaintainerId: uuid("updated_by_maintainer_id")
    .notNull()
    .references(() => maintainers.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const designationEvents = pgTable("designation_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  designationId: uuid("designation_id")
    .notNull()
    .references(() => channelDesignations.id),
  maintainerId: uuid("maintainer_id")
    .notNull()
    .references(() => maintainers.id),
  kind: designationEventKind("kind").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const catalogueState = pgTable("catalogue_state", {
  id: integer("id").primaryKey(),
  version: integer("version").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const evidenceSubmissions = pgTable("evidence_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  youtubeChannelId: varchar("youtube_channel_id", { length: 24 }).notNull(),
  rationale: text("rationale").notNull(),
  representativeVideoUrl: text("representative_video_url").notNull(),
  rateLimitKey: varchar("rate_limit_key", { length: 64 }).notNull(),
  status: evidenceSubmissionStatus("status").default("pending").notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedByMaintainerId: uuid("reviewed_by_maintainer_id").references(
    () => maintainers.id,
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const submissionRateLimits = pgTable("submission_rate_limits", {
  rateLimitKey: varchar("rate_limit_key", { length: 64 }).primaryKey(),
  count: integer("count").default(0).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
