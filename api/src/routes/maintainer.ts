import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { getCurrentMaintainer } from "../auth.js";
import { db } from "../db/client.js";
import {
  catalogueState,
  channelDesignations,
  channels,
  designationEvents,
  evidenceSubmissions,
  maintainers,
} from "../db/schema.js";
import { getGitHubUserByLogin } from "../lib/github.js";
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

const memberSchema = z.object({
  githubLogin: z.string().trim().min(1).max(255),
});

const removalSchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
});

const reviewSchema = z.object({
  status: z.enum(["reviewed", "dismissed"]),
});

async function requireMaintainer(
  context: Parameters<typeof getCurrentMaintainer>[0],
) {
  return getCurrentMaintainer(context);
}

function unauthorised(context: Parameters<typeof getCurrentMaintainer>[0]) {
  return context.json({ error: "Maintainer authorization required" }, 401);
}

export const maintainerRoutes = new Hono();

maintainerRoutes.get("/v1/maintainer/session", async (context) => {
  const maintainer = await getCurrentMaintainer(context);
  return context.json(
    maintainer
      ? {
          authenticated: true,
          maintainer: {
            githubLogin: maintainer.githubLogin,
            githubUserId: maintainer.githubUserId,
          },
        }
      : { authenticated: false },
  );
});

maintainerRoutes.get("/v1/maintainer/dashboard", async (context) => {
  const maintainer = await requireMaintainer(context);
  if (!maintainer) {
    return unauthorised(context);
  }

  const [designations, submissions, members] = await Promise.all([
    db
      .select({
        id: channelDesignations.id,
        rationale: channelDesignations.rationale,
        representativeVideoUrl: channelDesignations.representativeVideoUrl,
        status: channelDesignations.status,
        updatedAt: channelDesignations.updatedAt,
        youtubeChannelId: channels.youtubeChannelId,
      })
      .from(channelDesignations)
      .innerJoin(channels, eq(channelDesignations.channelId, channels.id))
      .orderBy(desc(channelDesignations.updatedAt)),
    db
      .select({
        createdAt: evidenceSubmissions.createdAt,
        id: evidenceSubmissions.id,
        rationale: evidenceSubmissions.rationale,
        representativeVideoUrl: evidenceSubmissions.representativeVideoUrl,
        reviewedAt: evidenceSubmissions.reviewedAt,
        status: evidenceSubmissions.status,
        youtubeChannelId: evidenceSubmissions.youtubeChannelId,
      })
      .from(evidenceSubmissions)
      .orderBy(desc(evidenceSubmissions.createdAt)),
    db
      .select({
        active: maintainers.active,
        githubLogin: maintainers.githubLogin,
        githubUserId: maintainers.githubUserId,
        id: maintainers.id,
      })
      .from(maintainers)
      .orderBy(maintainers.githubLogin),
  ]);

  return context.json({
    designations,
    maintainer: {
      githubLogin: maintainer.githubLogin,
      githubUserId: maintainer.githubUserId,
    },
    members,
    submissions,
  });
});

maintainerRoutes.post(
  "/v1/maintainer/evidence-submissions/:id/review",
  async (context) => {
    const maintainer = await requireMaintainer(context);
    if (!maintainer) {
      return unauthorised(context);
    }

    const input = reviewSchema.safeParse(await getJsonBody(context.req.raw));
    if (!input.success) {
      return context.json({ error: "Invalid evidence review" }, 400);
    }

    const [submission] = await db
      .update(evidenceSubmissions)
      .set({
        reviewedAt: new Date(),
        reviewedByMaintainerId: maintainer.id,
        status: input.data.status,
      })
      .where(eq(evidenceSubmissions.id, context.req.param("id")))
      .returning();
    if (!submission) {
      return context.json({ error: "Evidence submission not found" }, 404);
    }

    return context.json({ submission });
  },
);

maintainerRoutes.post("/v1/maintainer/members", async (context) => {
  const maintainer = await requireMaintainer(context);
  if (!maintainer) {
    return unauthorised(context);
  }

  const input = memberSchema.safeParse(await getJsonBody(context.req.raw));
  if (!input.success) {
    return context.json({ error: "Invalid GitHub login" }, 400);
  }

  const user = await getGitHubUserByLogin(input.data.githubLogin);
  if (!user) {
    return context.json({ error: "GitHub user not found" }, 404);
  }

  const [member] = await db
    .insert(maintainers)
    .values({ githubLogin: user.login, githubUserId: String(user.id) })
    .onConflictDoUpdate({
      set: {
        active: true,
        githubLogin: user.login,
        updatedAt: new Date(),
      },
      target: maintainers.githubUserId,
    })
    .returning();

  return context.json({ member }, 201);
});

maintainerRoutes.post(
  "/v1/maintainer/members/:githubUserId/deactivate",
  async (context) => {
    const maintainer = await requireMaintainer(context);
    if (!maintainer) {
      return unauthorised(context);
    }

    const githubUserId = context.req.param("githubUserId");
    if (githubUserId === maintainer.githubUserId) {
      return context.json(
        { error: "You cannot remove your own maintainer access" },
        400,
      );
    }

    const [member] = await db
      .update(maintainers)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(maintainers.githubUserId, githubUserId))
      .returning();
    if (!member) {
      return context.json({ error: "Maintainer not found" }, 404);
    }

    return context.json({ member });
  },
);

maintainerRoutes.post("/v1/maintainer/designations", async (context) => {
  const maintainer = await requireMaintainer(context);
  if (!maintainer) {
    return unauthorised(context);
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
    const maintainer = await requireMaintainer(context);
    if (!maintainer) {
      return unauthorised(context);
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
