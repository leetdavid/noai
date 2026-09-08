import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db/client.js";
import { maintainers } from "../db/schema.js";

const githubUserSchema = z.object({
  id: z.number().int().positive(),
  login: z.string().min(1),
});

export type GitHubUser = z.infer<typeof githubUserSchema>;

async function parseGitHubUser(response: Response): Promise<GitHubUser | null> {
  if (!response.ok) {
    return null;
  }

  const user = githubUserSchema.safeParse(await response.json());
  return user.success ? user.data : null;
}

export async function getGitHubUser(
  accessToken: string,
): Promise<GitHubUser | null> {
  return parseGitHubUser(
    await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "NoAI-Catalogue-API",
      },
    }),
  );
}

export async function getGitHubUserByLogin(
  login: string,
  appToken: string,
): Promise<GitHubUser | null> {
  return parseGitHubUser(
    await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${appToken}`,
        "User-Agent": "NoAI-Catalogue-API",
      },
    }),
  );
}

export async function getMaintainerByGitHubUserId(githubUserId: string) {
  const [maintainer] = await db
    .select()
    .from(maintainers)
    .where(
      and(
        eq(maintainers.githubUserId, githubUserId),
        eq(maintainers.active, true),
      ),
    )
    .limit(1);

  return maintainer ?? null;
}
