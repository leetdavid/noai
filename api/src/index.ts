import { serve } from "@hono/node-server";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { getConfiguration } from "./config.js";
import { db } from "./db/client.js";
import { authRoutes } from "./routes/auth.js";
import { catalogueRoutes } from "./routes/catalogue.js";
import { evidenceRoutes } from "./routes/evidence.js";
import { maintainerRoutes } from "./routes/maintainer.js";

const configuration = getConfiguration();
const app = new Hono();
const publicCors = cors({
  allowHeaders: ["Authorization", "Content-Type"],
  allowMethods: ["GET", "POST"],
  credentials: true,
  origin: configuration.PUBLIC_ORIGIN,
});

app.use("/v1/*", publicCors);
app.use("/auth/*", publicCors);

app.get("/health", async (context) => {
  await db.execute(sql`select 1`);
  return context.json({ status: "ok" });
});

app.route("/", catalogueRoutes);
app.route("/", evidenceRoutes);
app.route("/", maintainerRoutes);
app.route("/", authRoutes);

serve({
  fetch: app.fetch,
  port: configuration.PORT,
});
