import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { stubTurnstile, trackPageErrors } from "./e2e-runtime";

const channelId = "UCabcdefghijklmnopqrstuv";
const videoUrl = "https://www.youtube.com/watch?v=abcdefghijk";

async function submitChannel(
  page: Page,
  kind: "slop" | "allowlist",
  endpoint: string,
  successText: string,
) {
  const pageErrors = trackPageErrors(page);
  await stubTurnstile(page);
  let requestBody: unknown = null;
  await page.route(`**${endpoint}`, async (route) => {
    requestBody = await route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ status: "received" }),
    });
  });
  const params = new URLSearchParams({ channelId, videoUrl });
  if (kind === "allowlist") {
    params.set("kind", "allowlist");
  }
  await page.goto(`/submit?${params.toString()}`);
  await page
    .locator('[name="rationale"]')
    .fill("Human-made documentaries filmed on location.");
  const send = page.getByRole("button", { name: "Send for review" });
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByText(successText)).toBeVisible();
  expect(requestBody).toEqual({
    channelId,
    rationale: "Human-made documentaries filmed on location.",
    turnstileToken: "e2e-turnstile-token",
    videoUrl,
  });
  expect(pageErrors).toEqual([]);
}

test.describe("channel submissions", () => {
  test("sends a whitelist request to the trust endpoint", async ({ page }) => {
    await submitChannel(
      page,
      "allowlist",
      "/v1/trust-submissions",
      "Nothing has been added to the whitelist yet",
    );
    await expect(page.locator(".workflow-success .workflow-kicker")).toHaveText(
      "Whitelist request received",
    );
  });

  test("sends slop evidence to the evidence endpoint", async ({ page }) => {
    await submitChannel(
      page,
      "slop",
      "/v1/evidence-submissions",
      "Nothing has been added to the catalogue yet",
    );
  });
});
