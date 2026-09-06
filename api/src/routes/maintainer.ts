import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../db/client.js";
import {
  catalogueState,
  channelDesignations,
  channels,
  designationEvents,
  evidenceSubmissions,
} from "../db/schema.js";
import { getMaintainer } from "../lib/github.js";
import { getJsonBody } from "../lib/request.js";
import { isYouTubeChannelId, isYouTubeVideoUrl } from "../lib/youtube.js";

const designationSchema = z.object({
  channelId: z
    .string()
    .refine(isYouTubeChannelId, "Invalid YouTube channel ID"),
  rationale: z.string().trim().min(1).max(2_000),
  videoUrl: z
    .string()
    .url()
    .refine(isYouTubeVideoUrl, "Invalid YouTube video URL"),
});

const removalSchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
});

function getAccessToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
}

async function requireMaintainer(authorization: string | undefined) {
  const accessToken = getAccessToken(authorization);
  return accessToken ? getMaintainer(accessToken) : null;
}

export const maintainerRoutes = new Hono();

maintainerRoutes.get("/v1/maintainer/evidence-submissions", async (context) => {
  const maintainer = await requireMaintainer(
    context.req.header("authorization"),
  );
  if (!maintainer) {
    return context.json({ error: "Maintainer authorization required" }, 401);
  }

  const submissions = await db.select().from(evidenceSubmissions);
  return context.json({ submissions });
});

maintainerRoutes.post("/v1/maintainer/designations", async (context) => {
  const maintainer = await requireMaintainer(
    context.req.header("authorization"),
  );
  if (!maintainer) {
    return context.json({ error: "Maintainer authorization required" }, 401);
  }

  const input = designationSchema.safeParse(await getJsonBody(context.req.raw));
  if (!input.success) {
    return context.json({ error: "Invalid channel designation" }, 400);
  }

  const publication = await db.transaction(async (transaction) => {
    const [insertedChannel] = await transaction
      .insert(channels)
      .values({ youtubeChannelId: input.data.channelId })
      .onConflictDoNothing()
      .returning();
    const channel =
      insertedChannel ??
      (
        await transaction
          .select()
          .from(channels)
          .where(eq(channels.youtubeChannelId, input.data.channelId))
          .limit(1)
      )[0];
    if (!channel) {
      throw new Error("Unable to create channel");
    }

    const [existingDesignation] = await transaction
      .select()
      .from(channelDesignations)
      .where(eq(channelDesignations.channelId, channel.id))
      .limit(1);
    const now = new Date();
    const [designation] = await transaction
      .insert(channelDesignations)
      .values({
        channelId: channel.id,
        createdByMaintainerId: maintainer.id,
        rationale: input.data.rationale,
        representativeVideoUrl: input.data.videoUrl,
        updatedByMaintainerId: maintainer.id,
      })
      .onConflictDoUpdate({
        set: {
          rationale: input.data.rationale,
          representativeVideoUrl: input.data.videoUrl,
          status: "active",
          updatedAt: now,
          updatedByMaintainerId: maintainer.id,
        },
        target: channelDesignations.channelId,
      })
      .returning();
    if (!designation) {
      throw new Error("Unable to publish designation");
    }

    await transaction.insert(designationEvents).values({
      designationId: designation.id,
      kind: existingDesignation?.status === "active" ? "revised" : "published",
      maintainerId: maintainer.id,
      snapshot: input.data,
    });
    await transaction
      .insert(catalogueState)
      .values({ id: 1, version: 1 })
      .onConflictDoUpdate({
        set: {
          updatedAt: now,
          version: sql`${catalogueState.version} + 1`,
        },
        target: catalogueState.id,
      });

    return {
      designation,
      wasActive: existingDesignation?.status === "active",
    };
  });

  if (publication.wasActive) {
    return context.json(publication.designation, 200);
  }

  return context.json(publication.designation, 201);
});

maintainerRoutes.post(
  "/v1/maintainer/designations/:channelId/remove",
  async (context) => {
    const maintainer = await requireMaintainer(
      context.req.header("authorization"),
    );
    if (!maintainer) {
      return context.json({ error: "Maintainer authorization required" }, 401);
    }

    const channelId = context.req.param("channelId");
    if (!isYouTubeChannelId(channelId)) {
      return context.json({ error: "Invalid YouTube channel ID" }, 400);
    }

    const input = removalSchema.safeParse(await getJsonBody(context.req.raw));
    if (!input.success) {
      return context.json({ error: "Invalid removal reason" }, 400);
    }

    const removed = await db.transaction(async (transaction) => {
      const [designation] = await transaction
        .select({ designationId: channelDesignations.id })
        .from(channelDesignations)
        .innerJoin(channels, eq(channelDesignations.channelId, channels.id))
        .where(
          and(
            eq(channels.youtubeChannelId, channelId),
            eq(channelDesignations.status, "active"),
          ),
        )
        .limit(1);
      if (!designation) {
        return false;
      }

      const now = new Date();
      await transaction
        .update(channelDesignations)
        .set({
          status: "removed",
          updatedAt: now,
          updatedByMaintainerId: maintainer.id,
        })
        .where(eq(channelDesignations.id, designation.designationId));
      await transaction.insert(designationEvents).values({
        designationId: designation.designationId,
        kind: "removed",
        maintainerId: maintainer.id,
        snapshot: input.data,
      });
      await transaction
        .insert(catalogueState)
        .values({ id: 1, version: 1 })
        .onConflictDoUpdate({
          set: {
            updatedAt: now,
            version: sql`${catalogueState.version} + 1`,
          },
          target: catalogueState.id,
        });
      return true;
    });

    if (!removed) {
      return context.json({ error: "Active designation not found" }, 404);
    }

    return context.json({ status: "removed" });
  },
);
