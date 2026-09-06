import { getConfiguration } from "../config.js";
import { db, queryClient } from "./client.js";
import { maintainers } from "./schema.js";

const githubUserId = process.env.BOOTSTRAP_MAINTAINER_GITHUB_ID;
const githubLogin = process.env.BOOTSTRAP_MAINTAINER_GITHUB_LOGIN;

if (!githubUserId || !githubLogin) {
  throw new Error(
    "BOOTSTRAP_MAINTAINER_GITHUB_ID and BOOTSTRAP_MAINTAINER_GITHUB_LOGIN are required",
  );
}

getConfiguration();
await db
  .insert(maintainers)
  .values({ githubLogin, githubUserId })
  .onConflictDoUpdate({
    target: maintainers.githubUserId,
    set: { active: true, githubLogin, updatedAt: new Date() },
  });
await queryClient.end();
