import { createSign } from "node:crypto";

import { getConfiguration } from "../config.js";

export interface GitHubAppConfiguration {
  appId: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
  redirectUrl: string;
}

export function getGitHubAppConfiguration(): GitHubAppConfiguration | null {
  const configuration = getConfiguration();
  if (
    !configuration.GITHUB_APP_CLIENT_ID ||
    !configuration.GITHUB_APP_CLIENT_SECRET ||
    !configuration.GITHUB_APP_ID ||
    !configuration.GITHUB_APP_PRIVATE_KEY
  ) {
    return null;
  }

  return {
    appId: configuration.GITHUB_APP_ID,
    clientId: configuration.GITHUB_APP_CLIENT_ID,
    clientSecret: configuration.GITHUB_APP_CLIENT_SECRET,
    privateKey: configuration.GITHUB_APP_PRIVATE_KEY.replaceAll("\\n", "\n"),
    redirectUrl: configuration.GITHUB_APP_REDIRECT_URL,
  };
}

export function createGitHubAppToken(
  configuration: GitHubAppConfiguration,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      exp: now + 9 * 60,
      iat: now - 60,
      iss: configuration.appId,
    }),
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();

  return `${header}.${payload}.${signer.sign(configuration.privateKey, "base64url")}`;
}
