import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db/client.js";
import { maintainers } from "../db/schema.js";

const githubUserSchema = z.object({
  id: z.number().int().positive(),
  login: z.string().min(1),
});

export async function getMaintainer(accessToken: string) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "NoAI-Catalogue-API",
    },
  });

  if (!response.ok) {
    return null;
  }

  const user = githubUserSchema.safeParse(await response.json());
  if (!user.success) {
    return null;
  }

  const [maintainer] = await db
    .select()
    .from(maintainers)
    .where(
      and(
        eq(maintainers.githubUserId, String(user.data.id)),
        eq(maintainers.active, true),
      ),
    )
    .limit(1);

  return maintainer ?? null;
}
