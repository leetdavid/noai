import { expect, test } from "@playwright/test";

import { trackPageErrors } from "./e2e-runtime";

const channelId = "UCabcdefghijklmnopqrstuv";
const videoUrl = "https://www.youtube.com/watch?v=abcdefghijk";
const trustedChannelId = "UCzyxwvutsrqponmlkjihgfe";

const dashboard = {
  maintainer: { githubLogin: "catalogue-keeper", githubUserId: "41" },
  designations: [],
  submissions: [],
  trustSubmissions: [
    {
      id: "trust-1",
      rationale: "Human-made documentaries.",
      representativeVideoUrl: videoUrl,
      status: "pending",
      createdAt: "2026-09-08T09:00:00Z",
      reviewedAt: null,
      youtubeChannelId: trustedChannelId,
    },
  ],
  trustedDesignations: [
    {
      id: "trusted-1",
      rationale: "Original field reporting.",
      representativeVideoUrl: videoUrl,
      status: "active",
      updatedAt: "2026-09-08T10:00:00Z",
      youtubeChannelId: channelId,
    },
  ],
  members: [
    {
      id: "member-1",
      active: true,
      githubLogin: "catalogue-keeper",
      githubUserId: "41",
    },
  ],
};

test.describe("maintainer whitelist workflow", () => {
  test("publishes, reviews, and removes trusted designations", async ({
    page,
  }) => {
    const pageErrors = trackPageErrors(page);
    const posts: Array<{ path: string; body: unknown }> = [];
    await page.route("**/v1/maintainer/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: true }),
      });
    });
    await page.route("**/v1/maintainer/dashboard", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(dashboard),
      });
    });
    await page.route("**/v1/maintainer/**", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      posts.push({
        path: new URL(route.request().url()).pathname,
        body: route.request().postDataJSON(),
      });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      });
    });

    await page.goto("/maintain");
    await expect(
      page.getByRole("heading", { name: "Trusted whitelist" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Whitelist requests to review" }),
    ).toBeVisible();

    await page.locator('[name="trustedChannelId"]').fill(trustedChannelId);
    await page.locator('[name="trustedVideoUrl"]').fill(videoUrl);
    await page
      .locator('[name="trustedRationale"]')
      .fill("Human-made documentaries filmed on location.");
    await page
      .getByRole("button", { name: "Publish trusted designation" })
      .click();
    await expect(page.getByText("Trusted designation published")).toBeVisible();
    expect(posts).toContainEqual({
      path: "/v1/maintainer/trusted-designations",
      body: {
        channelId: trustedChannelId,
        rationale: "Human-made documentaries filmed on location.",
        videoUrl,
      },
    });

    await page
      .locator("#whitelist-requests")
      .getByRole("button", { name: "Copy into trusted draft" })
      .click();
    await expect(page.locator('[name="trustedChannelId"]')).toHaveValue(
      trustedChannelId,
    );
    await page
      .locator("#whitelist-requests")
      .getByRole("button", { name: "Mark reviewed", exact: true })
      .click();
    await expect(page.getByText("marked as reviewed")).toBeVisible();
    expect(posts).toContainEqual({
      path: "/v1/maintainer/trust-submissions/trust-1/review",
      body: { status: "reviewed" },
    });

    await page
      .getByRole("button", { name: "Remove trusted designation" })
      .click();
    await page
      .locator("#trusted-designation-removal textarea")
      .fill("The channel changed ownership.");
    await page.getByRole("button", { name: "Confirm removal" }).click();
    await expect(page.getByText("Trusted designation removed")).toBeVisible();
    expect(posts).toContainEqual({
      path: `/v1/maintainer/trusted-designations/${channelId}/remove`,
      body: { reason: "The channel changed ownership." },
    });

    expect(pageErrors).toEqual([]);
  });
});
