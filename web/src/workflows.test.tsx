// @vitest-environment jsdom

import { type ReactNode, StrictMode, act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MaintainApp } from "./maintain";

const channelId = "UCabcdefghijklmnopqrstuv";
const videoUrl = "https://www.youtube.com/watch?v=abcdefghijk";
const dashboard = {
  maintainer: { githubLogin: "catalogue-keeper", githubUserId: "41" },
  designations: [
    {
      id: "designation-1",
      rationale: "Repeated synthetic narration and generated footage.",
      representativeVideoUrl: videoUrl,
      status: "active",
      updatedAt: "2026-09-08T10:00:00Z",
      youtubeChannelId: channelId,
    },
  ],
  submissions: [
    {
      id: "evidence-1",
      rationale: "The same generated scenes appear across the channel.",
      representativeVideoUrl: videoUrl,
      status: "pending",
      createdAt: "2026-09-08T09:00:00Z",
      reviewedAt: null,
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
    {
      id: "member-2",
      active: true,
      githubLogin: "second-reader",
      githubUserId: "42",
    },
  ],
};

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/session"))
      return Response.json({ authenticated: true });
    if (path.endsWith("/dashboard")) return Response.json(dashboard);
    return Response.json({ status: "received" });
  });
  window.history.replaceState({}, "", "/");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.turnstile = undefined;
  for (const script of document.querySelectorAll(
    "script[data-noai-turnstile]",
  )) {
    script.remove();
  }
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function render(element: ReactNode): Promise<void> {
  await act(async () => root.render(element));
}

function button(name: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll("button")).find(
    (element) => element.textContent?.trim() === name,
  );
  if (!match) throw new Error(`Button not found: ${name}`);
  return match;
}

async function click(name: string): Promise<void> {
  await act(async () => button(name).click());
}

function field(selector: string): HTMLInputElement | HTMLTextAreaElement {
  const element = container.querySelector(selector);
  if (
    !(
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    )
  )
    throw new Error(`Field not found: ${selector}`);
  return element;
}

async function fill(selector: string, value: string): Promise<void> {
  const element = field(selector);
  const prototype =
    element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(
      element,
      value,
    );
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function posts() {
  return fetchMock.mock.calls
    .filter(([, options]) => options?.method === "POST")
    .map(([input, options]) => ({
      path: new URL(String(input)).pathname,
      body: options?.body,
      credentials: options?.credentials,
    }));
}

function installTurnstile() {
  const renderWidget = vi
    .fn<NonNullable<Window["turnstile"]>["render"]>()
    .mockReturnValue("widget-1");
  const remove = vi.fn();
  window.turnstile = { render: renderWidget, remove };
  return {
    renderWidget,
    remove,
    challenge: () => {
      const call = renderWidget.mock.calls.at(-1);
      if (!call) throw new Error("No verification challenge was rendered");
      return call[1];
    },
  };
}

describe("maintainer workflows", () => {
  it("retries a failed load and keeps GitHub sign-in and the shared navigation", async () => {
    window.history.replaceState({}, "", "/maintain?auth=denied");
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await render(<MaintainApp />);
    expect(container.textContent).toContain(
      "Check your connection and try again",
    );
    fetchMock.mockResolvedValueOnce(Response.json({ authenticated: false }));
    await click("Try again");
    expect(container.textContent).toContain("doesn't have maintainer access");
    expect(container.textContent).toContain("NoAI - a less sloppier web");
    expect(container.querySelector('a[href$="/auth/github"]')).not.toBeNull();
    expect(
      Array.from(
        container.querySelectorAll('nav[aria-label="Main navigation"] a'),
      ).map((link) => link.textContent),
    ).toEqual([
      "Home",
      "Submit a channel",
      "Whitelist a channel",
      "Maintainers",
    ]);
  });

  it("loads an existing designation into an editable draft without implicitly reviewing evidence", async () => {
    await render(
      <StrictMode>
        <MaintainApp />
      </StrictMode>,
    );
    await click("Edit designation");
    expect(field('[name="channelId"]').value).toBe(channelId);
    expect(field('[name="rationale"]').value).toBe(
      dashboard.designations[0]?.rationale,
    );
    await fill(
      '[name="rationale"]',
      "  Updated rationale with checked evidence.  ",
    );
    await click("Publish revision");
    expect(posts()).toEqual([
      {
        path: "/v1/maintainer/designations",
        body: JSON.stringify({
          channelId,
          rationale: "Updated rationale with checked evidence.",
          videoUrl,
        }),
        credentials: "include",
      },
    ]);
    expect(container.textContent).toContain(
      "Evidence submissions have not changed",
    );
    expect(container.textContent).toContain("1 pending");
    expect(field('[name="rationale"]').value).toBe("");
  });

  it("keeps a copied draft on refresh failure and requires a nonblank rationale", async () => {
    await render(<MaintainApp />);
    await click("Copy into draft");
    expect(field('[name="rationale"]').value).toBe(
      dashboard.submissions[0]?.rationale,
    );
    expect(posts()).toHaveLength(0);
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await click("Refresh lists");
    expect(container.textContent).toContain("lists below may be out of date");
    expect(field('[name="channelId"]').value).toBe(channelId);
    await click("Retry refresh");
    expect(container.textContent).not.toContain(
      "lists below may be out of date",
    );
    await fill('[name="rationale"]', "   ");
    await click("Publish revision");
    expect(container.textContent).toContain(
      "Add a rationale before publishing",
    );
    expect(posts()).toHaveLength(0);
  });

  it("requires an inline removal reason, supports cancel, and preserves a failed reason for retry", async () => {
    await render(<MaintainApp />);
    await click("Remove designation");
    expect(document.activeElement).toBe(field("#designation-removal textarea"));
    await fill("#designation-removal textarea", "   ");
    await click("Confirm removal");
    expect(container.textContent).toContain(
      "Add a reason so other maintainers",
    );
    expect(posts()).toHaveLength(0);
    await click("Cancel");
    expect(container.querySelector("#designation-removal")).toBeNull();
    expect(document.activeElement).toBe(button("Remove designation"));
    await click("Remove designation");
    await fill(
      "#designation-removal textarea",
      "  The channel now publishes original footage.  ",
    );
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await click("Confirm removal");
    expect(field("#designation-removal textarea").value).toContain(
      "original footage",
    );
    await click("Confirm removal");
    expect(posts().at(-1)).toMatchObject({
      path: `/v1/maintainer/designations/${channelId}/remove`,
      body: JSON.stringify({
        reason: "The channel now publishes original footage.",
      }),
    });
    expect(container.textContent).toContain("Its history is preserved");
  });

  it("only reviews or dismisses evidence through explicit actions", async () => {
    await render(<MaintainApp />);
    await click("Mark reviewed");
    await click("Dismiss");
    expect(posts().map(({ path, body }) => ({ path, body }))).toEqual([
      {
        path: "/v1/maintainer/evidence-submissions/evidence-1/review",
        body: JSON.stringify({ status: "reviewed" }),
      },
      {
        path: "/v1/maintainer/evidence-submissions/evidence-1/review",
        body: JSON.stringify({ status: "dismissed" }),
      },
    ]);
  });

  it("summarizes everything needing review across both queues", async () => {
    await render(<MaintainApp />);
    const summary = container.querySelector("#review-queue");
    expect(summary?.querySelector("h2")?.textContent).toBe("Needs your review");
    expect(summary?.querySelector(".workflow-badge")?.textContent).toBe(
      "1 pending",
    );
    expect(summary?.textContent).toContain("1 blacklist evidence submission");
    expect(summary?.textContent).toContain("no whitelist requests");
    expect(
      summary?.querySelector('a[href="#evidence"]')?.textContent,
    ).toContain("Review evidence (1)");
    expect(summary?.querySelector('a[href="#whitelist-requests"]')).toBeNull();
  });

  it("shows an honest all-caught-up state when both queues are empty", async () => {
    fetchMock.mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/session"))
        return Response.json({ authenticated: true });
      if (path.endsWith("/dashboard"))
        return Response.json({ ...dashboard, submissions: [] });
      return Response.json({ status: "received" });
    });
    await render(<MaintainApp />);
    const summary = container.querySelector("#review-queue");
    expect(summary?.querySelector(".workflow-badge")?.textContent).toBe(
      "0 pending",
    );
    expect(summary?.textContent).toContain("all caught up");
    expect(summary?.querySelector("a")).toBeNull();
  });

  it("adds and deactivates maintainers without offering self-deactivation", async () => {
    await render(<MaintainApp />);
    expect(
      container.querySelector('[aria-label="Deactivate @catalogue-keeper"]'),
    ).toBeNull();
    await fill('[name="githubLogin"]', "  new-reader  ");
    await click("Add maintainer");
    await click("Deactivate");
    expect(posts()).toMatchObject([
      {
        path: "/v1/maintainer/members",
        body: JSON.stringify({ githubLogin: "new-reader" }),
      },
      { path: "/v1/maintainer/members/42/deactivate" },
    ]);
    expect(field('[name="githubLogin"]').value).toBe("");
  });
});

describe("public evidence submissions", () => {
  beforeEach(() => {
    window.history.replaceState(
      {},
      "",
      `/submit?${new URLSearchParams({ channelId, videoUrl })}`,
    );
  });

  it("shows an honest unavailable state with preserved context when the site key is missing", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    const { SubmitApp } = await import("./submit");
    await render(<SubmitApp />);
    expect(container.textContent).toContain(
      "Submissions are temporarily unavailable",
    );
    expect(container.textContent).toContain("NoAI - a less sloppier web");
    expect(container.textContent).toContain(channelId);
    expect(container.textContent).toContain(videoUrl);
    expect(container.querySelector("form")).toBeNull();
    expect(document.querySelector("script[data-noai-turnstile]")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves failed evidence, renews a consumed challenge, and confirms success only after acceptance", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-site-key");
    const turnstile = installTurnstile();
    const { SubmitApp } = await import("./submit");
    await render(
      <StrictMode>
        <SubmitApp />
      </StrictMode>,
    );
    expect(button("Send for review").disabled).toBe(true);
    expect(turnstile.challenge()).toMatchObject({
      sitekey: "test-site-key",
      theme: "light",
      size: "flexible",
    });
    await fill(
      '[name="rationale"]',
      "  Generated scenes recur throughout the channel.  ",
    );
    await act(async () => turnstile.challenge().callback("first-token"));
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: "Please try later" }, { status: 503 }),
    );
    await click("Send for review");
    expect(container.textContent).toContain("Please try later");
    expect(field('[name="rationale"]').value).toContain("Generated scenes");
    expect(button("Try sending again").disabled).toBe(true);
    expect(turnstile.remove).toHaveBeenCalled();
    await act(async () => turnstile.challenge().callback("fresh-token"));
    await click("Try sending again");
    expect(posts().at(-1)).toMatchObject({
      path: "/v1/evidence-submissions",
      body: JSON.stringify({
        channelId,
        rationale: "Generated scenes recur throughout the channel.",
        turnstileToken: "fresh-token",
        videoUrl,
      }),
    });
    expect(container.textContent).toContain(
      "Nothing has been added to the catalogue yet",
    );
    expect(document.activeElement?.id).toBe("submission-title");
    expect(container.querySelector("form")).toBeNull();
    await click("Submit another channel");
    expect(field('[name="channelId"]').value).toBe("");
    expect(field('[name="rationale"]').value).toBe("");
    expect(button("Send for review").disabled).toBe(true);
  });

  it("invalidates expired tokens and ignores callbacks from a removed widget", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-site-key");
    const turnstile = installTurnstile();
    const { SubmitApp } = await import("./submit");
    await render(<SubmitApp />);
    const previousChallenge = turnstile.challenge();
    await act(async () => previousChallenge.callback("expired-token"));
    await act(async () => previousChallenge["expired-callback"]());
    expect(button("Send for review").disabled).toBe(true);
    expect(container.textContent).toContain("verification expired");
    await click("Retry verification");
    await act(async () => turnstile.challenge().callback("current-token"));
    await act(async () => previousChallenge["error-callback"]());
    expect(button("Send for review").disabled).toBe(false);
    expect(container.textContent).toContain("Verification complete");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries script loading without losing entered evidence", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-site-key");
    const { SubmitApp } = await import("./submit");
    await render(<SubmitApp />);
    await fill(
      '[name="rationale"]',
      "Keep this evidence while verification is unavailable.",
    );
    const script = document.querySelector("script[data-noai-turnstile]");
    expect(script).not.toBeNull();
    await act(async () => {
      script?.dispatchEvent(new Event("error"));
    });
    expect(container.textContent).toContain("Verification couldn't load");
    await click("Retry verification");
    expect(field('[name="rationale"]').value).toContain("Keep this evidence");
    expect(document.querySelector("script[data-noai-turnstile]")).not.toBe(
      script,
    );
    expect(button("Send for review").disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses a compact verification challenge on narrow phones", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-site-key");
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const turnstile = installTurnstile();
    const { SubmitApp } = await import("./submit");
    await render(<SubmitApp />);
    expect(turnstile.challenge().size).toBe("compact");
  });

  it("sends whitelist requests to the trust endpoint with trusted copy", async () => {
    window.history.replaceState(
      {},
      "",
      `/submit?${new URLSearchParams({ channelId, kind: "allowlist", videoUrl })}`,
    );
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-site-key");
    const turnstile = installTurnstile();
    const { SubmitApp } = await import("./submit");
    await render(<SubmitApp />);
    expect(container.textContent).toContain("Whitelist a channel");
    expect(container.textContent).toContain("never be filtered");
    await fill(
      '[name="rationale"]',
      "  Original interviews filmed on location.  ",
    );
    await act(async () => turnstile.challenge().callback("trust-token"));
    await click("Send for review");
    expect(posts().at(-1)).toMatchObject({
      path: "/v1/trust-submissions",
      body: JSON.stringify({
        channelId,
        rationale: "Original interviews filmed on location.",
        turnstileToken: "trust-token",
        videoUrl,
      }),
    });
    expect(container.textContent).toContain(
      "Nothing has been added to the whitelist yet",
    );
  });
});

describe("trusted whitelist workflows", () => {
  it("publishes trusted designations and reviews whitelist requests", async () => {
    const trustedDashboard = {
      ...dashboard,
      trustSubmissions: [
        {
          id: "trust-1",
          rationale: "Human-made documentaries.",
          representativeVideoUrl: videoUrl,
          status: "pending",
          createdAt: "2026-09-08T09:00:00Z",
          reviewedAt: null,
          youtubeChannelId: channelId,
        },
      ],
      trustedDesignations: [],
    };
    fetchMock.mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/session"))
        return Response.json({ authenticated: true });
      if (path.endsWith("/dashboard")) return Response.json(trustedDashboard);
      return Response.json({ status: "received" });
    });
    await render(<MaintainApp />);
    expect(container.textContent).toContain("Whitelist requests to review");
    await fill('[name="trustedChannelId"]', channelId);
    await fill('[name="trustedVideoUrl"]', videoUrl);
    await fill(
      '[name="trustedRationale"]',
      "  Human-made documentaries filmed on location.  ",
    );
    await click("Publish trusted designation");
    expect(posts()).toContainEqual({
      path: "/v1/maintainer/trusted-designations",
      body: JSON.stringify({
        channelId,
        rationale: "Human-made documentaries filmed on location.",
        videoUrl,
      }),
      credentials: "include",
    });
    await click("Copy into trusted draft");
    expect(field('[name="trustedChannelId"]').value).toBe(channelId);
    const whitelistSection = container.querySelector("#whitelist-requests");
    const markReviewed = Array.from(
      whitelistSection?.querySelectorAll("button") ?? [],
    ).find((element) => element.textContent?.trim() === "Mark reviewed");
    if (!(markReviewed instanceof HTMLButtonElement))
      throw new Error("Whitelist Mark reviewed not found");
    await act(async () => markReviewed.click());
    expect(posts().at(-1)).toMatchObject({
      path: "/v1/maintainer/trust-submissions/trust-1/review",
      body: JSON.stringify({ status: "reviewed" }),
    });
  });
});
