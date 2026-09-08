import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { z } from "zod";

import { getConfiguration } from "./config.js";
import { getGitHubUser, getMaintainerByGitHubUserId } from "./lib/github.js";

const sessionCookieName = "noai_session";
const stateCookieName = "noai_oauth_state";
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;
const stateLifetimeSeconds = 60 * 10;

const sessionSchema = z.object({
  expiresAt: z.number().int().positive(),
  githubUserId: z.string().min(1),
  kind: z.literal("session"),
});

const stateSchema = z.object({
  expiresAt: z.number().int().positive(),
  kind: z.literal("state"),
  value: z.string().min(1),
});

type Session = z.infer<typeof sessionSchema>;

function getOAuthConfiguration() {
  const configuration = getConfiguration();
  if (
    !configuration.GITHUB_CLIENT_ID ||
    !configuration.GITHUB_CLIENT_SECRET ||
    !configuration.SESSION_SECRET
  ) {
    return null;
  }

  return {
    clientId: configuration.GITHUB_CLIENT_ID,
    clientSecret: configuration.GITHUB_CLIENT_SECRET,
    redirectUrl: configuration.GITHUB_OAUTH_REDIRECT_URL,
    sessionSecret: configuration.SESSION_SECRET,
  };
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function createSignedValue(value: object, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

function hasSameValue(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function parseSignedValue(value: string, secret: string): unknown | null {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = sign(encoded, secret);
  if (!hasSameValue(expectedSignature, signature)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function setAuthCookie(
  context: Context,
  name: string,
  value: string,
  maxAge: number,
): void {
  setCookie(context, name, value, {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "Lax",
    secure: getConfiguration().NODE_ENV === "production",
  });
}

function createSession(githubUserId: string): Session {
  return {
    expiresAt: Date.now() + sessionLifetimeSeconds * 1000,
    githubUserId,
    kind: "session",
  };
}

export function startGitHubLogin(context: Context): Response {
  const oauth = getOAuthConfiguration();
  if (!oauth) {
    return context.redirect(
      `${getConfiguration().PUBLIC_ORIGIN}/maintain?auth=unavailable`,
    );
  }

  const value = randomBytes(24).toString("base64url");
  const state: z.infer<typeof stateSchema> = {
    expiresAt: Date.now() + stateLifetimeSeconds * 1000,
    kind: "state",
    value,
  };
  setAuthCookie(
    context,
    stateCookieName,
    createSignedValue(state, oauth.sessionSecret),
    stateLifetimeSeconds,
  );

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", oauth.clientId);
  url.searchParams.set("redirect_uri", oauth.redirectUrl);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", value);
  return context.redirect(url.toString());
}

export async function finishGitHubLogin(context: Context): Promise<Response> {
  const oauth = getOAuthConfiguration();
  const configuration = getConfiguration();
  if (!oauth) {
    return context.redirect(
      `${configuration.PUBLIC_ORIGIN}/maintain?auth=unavailable`,
    );
  }

  const code = context.req.query("code");
  const state = context.req.query("state");
  const stateCookie = getCookie(context, stateCookieName);
  const parsedState = stateCookie
    ? stateSchema.safeParse(parseSignedValue(stateCookie, oauth.sessionSecret))
    : null;
  if (
    !code ||
    !state ||
    !parsedState?.success ||
    parsedState.data.expiresAt < Date.now() ||
    !hasSameValue(state, parsedState.data.value)
  ) {
    return context.redirect(
      `${configuration.PUBLIC_ORIGIN}/maintain?auth=failed`,
    );
  }

  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new URLSearchParams({
        client_id: oauth.clientId,
        client_secret: oauth.clientSecret,
        code,
        redirect_uri: oauth.redirectUrl,
      }),
    },
  );
  const token = z
    .object({ access_token: z.string().min(1) })
    .safeParse(await tokenResponse.json());
  if (!token.success) {
    return context.redirect(
      `${configuration.PUBLIC_ORIGIN}/maintain?auth=failed`,
    );
  }

  const user = await getGitHubUser(token.data.access_token);
  const maintainer = user
    ? await getMaintainerByGitHubUserId(String(user.id))
    : null;
  if (!maintainer) {
    return context.redirect(
      `${configuration.PUBLIC_ORIGIN}/maintain?auth=denied`,
    );
  }

  setAuthCookie(
    context,
    sessionCookieName,
    createSignedValue(
      createSession(maintainer.githubUserId),
      oauth.sessionSecret,
    ),
    sessionLifetimeSeconds,
  );
  return context.redirect(`${configuration.PUBLIC_ORIGIN}/maintain`);
}

export async function getCurrentMaintainer(context: Context) {
  const oauth = getOAuthConfiguration();
  const sessionCookie = getCookie(context, sessionCookieName);
  if (!oauth || !sessionCookie) {
    return null;
  }

  const session = sessionSchema.safeParse(
    parseSignedValue(sessionCookie, oauth.sessionSecret),
  );
  if (!session.success || session.data.expiresAt < Date.now()) {
    return null;
  }

  return getMaintainerByGitHubUserId(session.data.githubUserId);
}

export function clearSession(context: Context): void {
  setCookie(context, sessionCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "Lax",
    secure: getConfiguration().NODE_ENV === "production",
  });
}
