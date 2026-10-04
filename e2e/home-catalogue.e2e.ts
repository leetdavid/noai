import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { trackPageErrors } from "./e2e-runtime";

const slopChannelId = "UCabcdefghijklmnopqrstuv";
const trustedChannelId = "UCzyxwvutsrqponmlkjihgfe";

async function gotoHomeWithCatalogue(page: Page): Promise<Error[]> {
  const pageErrors = trackPageErrors(page);
  await page.route("**/v1/catalogue", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: "8",
        channelIds: [slopChannelId],
        trustedChannelIds: [trustedChannelId],
      }),
    });
  });
  await page.goto("/");
  await expect(page.getByText("1 designated channel")).toBeVisible();
  await expect(page.getByText("1 whitelisted", { exact: false })).toBeVisible();
  return pageErrors;
}

test.describe("home catalogue with whitelist", () => {
  test("reports a trusted channel as never filtered", async ({ page }) => {
    const pageErrors = await gotoHomeWithCatalogue(page);
    await page
      .locator("#catalogue-query")
      .fill(`https://www.youtube.com/channel/${trustedChannelId}`);
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.locator(".lookup-result")).toContainText(
      "never filters it",
    );
    expect(pageErrors).toEqual([]);
  });

  test("reports a slop channel as filtered unless exempted", async ({
    page,
  }) => {
    const pageErrors = await gotoHomeWithCatalogue(page);
    await page.locator("#catalogue-query").fill(slopChannelId);
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.locator(".lookup-result")).toContainText(
      "is in the public catalogue",
    );
    expect(pageErrors).toEqual([]);
  });

  test("links to the whitelist submission flow", async ({ page }) => {
    const pageErrors = await gotoHomeWithCatalogue(page);
    await expect(
      page.getByRole("link", { name: /whitelist a channel/i }).first(),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
