import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db/client.js";
import {
  catalogueState,
  channelDesignations,
  channels,
  trustedDesignations,
} from "../db/schema.js";

export const catalogueRoutes = new Hono();

catalogueRoutes.get("/v1/catalogue", async (context) => {
  const [state] = await db.select().from(catalogueState).limit(1);
  const [designations, trusted] = await Promise.all([
    db
      .select({ youtubeChannelId: channels.youtubeChannelId })
      .from(channelDesignations)
      .innerJoin(channels, eq(channelDesignations.channelId, channels.id))
      .where(eq(channelDesignations.status, "active"))
      .orderBy(asc(channels.youtubeChannelId)),
    db
      .select({ youtubeChannelId: channels.youtubeChannelId })
      .from(trustedDesignations)
      .innerJoin(channels, eq(trustedDesignations.channelId, channels.id))
      .where(eq(trustedDesignations.status, "active"))
      .orderBy(asc(channels.youtubeChannelId)),
  ]);

  return context.json(
    {
      version: String(state?.version ?? 0),
      channelIds: designations.map(({ youtubeChannelId }) => youtubeChannelId),
      trustedChannelIds: trusted.map(
        ({ youtubeChannelId }) => youtubeChannelId,
      ),
    },
    200,
    {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3300",
    },
  );
});
