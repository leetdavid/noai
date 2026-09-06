import { createHmac } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { getConfiguration } from "../config.js";
import { db } from "../db/client.js";
import { evidenceSubmissions, submissionRateLimits } from "../db/schema.js";
import { getJsonBody } from "../lib/request.js";
import { isYouTubeChannelId, isYouTubeVideoUrl } from "../lib/youtube.js";

const evidenceSubmissionSchema = z.object({
  channelId: z
    .string()
    .refine(isYouTubeChannelId, "Invalid YouTube channel ID"),
  rationale: z.string().trim().min(1).max(2_000),
  turnstileToken: z.string().min(1),
  videoUrl: z
    .string()
    .url()
    .refine(isYouTubeVideoUrl, "Invalid YouTube video URL"),
});

const turnstileResponseSchema = z.object({
  success: z.boolean(),
});

const dailySubmissionLimit = 5;

function getRequesterIp(forwardedFor: string | undefined): string | null {
  const ip = forwardedFor?.split(",")[0]?.trim();
  return ip || null;
}

function getRateLimitKey(ip: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHmac("sha256", getConfiguration().ABUSE_HASH_SECRET)
    .update(`${day}:${ip}`)
    .digest("hex");
}

function getRateLimitExpiry(): Date {
  const expiry = new Date();
  expiry.setUTCHours(24, 0, 0, 0);
  return expiry;
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  try {
    const configuration = getConfiguration();
    if (!configuration.TURNSTILE_SECRET_KEY) {
      return false;
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({
          remoteip: ip,
          response: token,
          secret: configuration.TURNSTILE_SECRET_KEY,
        }),
      },
    );
    const result = turnstileResponseSchema.safeParse(await response.json());
    return result.success && result.data.success;
  } catch {
    return false;
  }
}

export const evidenceRoutes = new Hono();

evidenceRoutes.post("/v1/evidence-submissions", async (context) => {
  if (!getConfiguration().TURNSTILE_SECRET_KEY) {
    return context.json({ error: "Evidence submissions are not enabled" }, 503);
  }

  const parsedSubmission = evidenceSubmissionSchema.safeParse(
    await getJsonBody(context.req.raw),
  );
  if (!parsedSubmission.success) {
    return context.json({ error: "Invalid evidence submission" }, 400);
  }

  const ip = getRequesterIp(context.req.header("x-forwarded-for"));
  if (!ip) {
    return context.json({ error: "Unable to validate this submission" }, 400);
  }

  if (!(await verifyTurnstile(parsedSubmission.data.turnstileToken, ip))) {
    return context.json({ error: "Unable to validate this submission" }, 400);
  }

  const rateLimitKey = getRateLimitKey(ip);
  const expiry = getRateLimitExpiry();
  const accepted = await db.transaction(async (transaction) => {
    await transaction
      .delete(submissionRateLimits)
      .where(lt(submissionRateLimits.expiresAt, new Date()));
    const [quota] = await transaction
      .insert(submissionRateLimits)
      .values({ count: 1, expiresAt: expiry, rateLimitKey })
      .onConflictDoUpdate({
        set: {
          count: sql`${submissionRateLimits.count} + 1`,
          expiresAt: expiry,
        },
        setWhere: lt(submissionRateLimits.count, dailySubmissionLimit),
        target: submissionRateLimits.rateLimitKey,
      })
      .returning({ count: submissionRateLimits.count });
    if (!quota) {
      return false;
    }

    await transaction.insert(evidenceSubmissions).values({
      rationale: parsedSubmission.data.rationale,
      rateLimitKey,
      representativeVideoUrl: parsedSubmission.data.videoUrl,
      youtubeChannelId: parsedSubmission.data.channelId,
    });
    return true;
  });

  if (!accepted) {
    return context.json({ error: "Daily submission limit reached" }, 429);
  }

  return context.json({ status: "received" }, 201);
});
