import { Hono } from "hono";

import { clearSession, finishGitHubLogin, startGitHubLogin } from "../auth.js";

export const authRoutes = new Hono();

authRoutes.get("/auth/github", startGitHubLogin);
authRoutes.get("/auth/github/callback", finishGitHubLogin);
authRoutes.post("/auth/logout", (context) => {
  clearSession(context);
  return context.json({ status: "signed-out" });
});
