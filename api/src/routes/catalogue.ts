import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db/client.js";
import { catalogueState, channelDesignations, channels } from "../db/schema.js";

export const catalogueRoutes = new Hono();

catalogueRoutes.get("/v1/catalogue", async (context) => {
  const [state] = await db.select().from(catalogueState).limit(1);
  const designations = await db
    .select({ youtubeChannelId: channels.youtubeChannelId })
    .from(channelDesignations)
    .innerJoin(channels, eq(channelDesignations.channelId, channels.id))
    .where(eq(channelDesignations.status, "active"))
    .orderBy(asc(channels.youtubeChannelId));

  return context.json(
    {
      version: String(state?.version ?? 0),
      channelIds: designations.map(({ youtubeChannelId }) => youtubeChannelId),
    },
    200,
    {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3300",
    },
  );
});
