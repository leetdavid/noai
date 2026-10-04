// @vitest-environment jsdom
/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import optionsHtml from "./options.html?raw";
import popupHtml from "./popup.html?raw";
import { getBlockedChannels } from "./shared/blocked-channels";
import {
  addPersonalDesignation,
  addPersonalExemption,
  getSettings,
  removePersonalDesignation,
  saveSettings,
} from "./shared/settings";

vi.mock("./shared/settings", () => ({
  addPersonalDesignation: vi.fn(),
  addPersonalExemption: vi.fn(),
  getSettings: vi.fn(),
  removePersonalDesignation: vi.fn(),
  removePersonalExemption: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock("./shared/blocked-channels", () => ({
  BLOCKED_CHANNELS_STORAGE_KEY: "blocked-channels",
  getBlockedChannels: vi.fn(),
}));

const channelId = "UCabcdefghijklmnopqrstuv";
const storageListener = vi.fn();
let documentListeners = vi.spyOn(document, "addEventListener");

function element<T extends HTMLElement>(id: string, type: { new (): T }): T {
  const result = document.getElementById(id);
  if (!(result instanceof type)) {
    throw new Error(`Missing ${id}`);
  }
  return result;
}

async function loadPage(page: "popup" | "options"): Promise<void> {
  document.documentElement.innerHTML =
    page === "popup" ? popupHtml : optionsHtml;
  if (page === "popup") {
    await import("./popup");
  } else {
    await import("./options");
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  documentListeners = vi.spyOn(document, "addEventListener");
  vi.stubGlobal("chrome", {
    storage: { onChanged: { addListener: storageListener } },
  });
  vi.mocked(getSettings).mockResolvedValue({
    enabled: true,
    personalDesignations: [],
    personalDesignationNames: {},
    personalExemptions: [],
  });
  vi.mocked(getBlockedChannels).mockResolvedValue([]);
});

afterEach(() => {
  for (const [type, listener, options] of documentListeners.mock.calls) {
    document.removeEventListener(type, listener, options);
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Popup UI", () => {
  it("loads CSS from the HTML head and shows an honest empty state", async () => {
    await loadPage("popup");

    expect(
      document.head
        .querySelector('link[rel="stylesheet"]')
        ?.getAttribute("href"),
    ).toBe("./ui.css");
    expect(document.title).toBe("NoAI - a less sloppier web");
    expect(element("blocked-count", HTMLElement).textContent).toBe(
      "No channels yet",
    );
    expect(element("blocked-message", HTMLElement).textContent).toContain(
      "Nothing filtered yet",
    );
    expect(element("blocked-list", HTMLUListElement).hidden).toBe(true);
    expect(element("enabled", HTMLInputElement).checked).toBe(true);
  });

  it("keeps loading separate from the empty state", async () => {
    vi.mocked(getBlockedChannels).mockReturnValue(new Promise(() => {}));
    await loadPage("popup");

    expect(element("blocked-count", HTMLElement).textContent).toBe(
      "Loading...",
    );
    expect(
      element("blocked-list", HTMLUListElement).getAttribute("aria-busy"),
    ).toBe("true");
    expect(element("blocked-message", HTMLElement).textContent).not.toContain(
      "Nothing filtered",
    );
    expect(element("enabled", HTMLInputElement).disabled).toBe(false);
  });

  it("renders recent channel links, sources and times", async () => {
    vi.mocked(getBlockedChannels).mockResolvedValue([
      {
        channelId,
        channelName: "A channel with a long name",
        source: "personal",
        lastBlockedAt: Date.now() - 120_000,
      },
    ]);
    await loadPage("popup");

    const list = element("blocked-list", HTMLUListElement);
    expect(list.querySelector("a")?.href).toBe(
      `https://www.youtube.com/channel/${channelId}`,
    );
    expect(list.querySelector("a")?.rel).toBe("noopener noreferrer");
    expect(list.querySelector(".activity-source")?.textContent).toBe(
      "Personal rule",
    );
    expect(list.querySelector("time")?.textContent).toBe("2m ago");
    expect(element("blocked-count", HTMLElement).textContent).toBe("1 channel");
    expect(element("blocked-message", HTMLElement).hidden).toBe(true);
  });

  it("keeps the switch usable when local activity cannot load", async () => {
    vi.mocked(getBlockedChannels).mockRejectedValue(
      new Error("Storage unavailable"),
    );
    await loadPage("popup");

    expect(element("blocked-message", HTMLElement).dataset.state).toBe("error");
    expect(
      element("blocked-list", HTMLUListElement).getAttribute("aria-busy"),
    ).toBe("false");
    expect(element("enabled", HTMLInputElement).disabled).toBe(false);
  });

  it("persists the catalogue switch without changing personal rules", async () => {
    await loadPage("popup");
    element("enabled", HTMLInputElement).click();

    await vi.waitFor(() =>
      expect(element("status", HTMLElement).textContent).toBe(
        "Paused for YouTube",
      ),
    );
    expect(saveSettings).toHaveBeenCalledExactlyOnceWith({ enabled: false });
    expect(element("filter-note", HTMLElement).textContent).toContain(
      "personal rules always apply",
    );
  });

  it("restores the switch after a failed save and allows retry", async () => {
    vi.mocked(saveSettings).mockRejectedValueOnce(new Error("Write failed"));
    await loadPage("popup");
    const input = element("enabled", HTMLInputElement);
    input.click();

    await vi.waitFor(() =>
      expect(element("status", HTMLElement).dataset.state).toBe("error"),
    );
    expect(input.checked).toBe(true);
    expect(input.disabled).toBe(false);
    input.click();
    await vi.waitFor(() =>
      expect(element("status", HTMLElement).textContent).toBe(
        "Paused for YouTube",
      ),
    );
  });
});

describe("Personal-rule settings UI", () => {
  it("loads CSS explicitly and distinguishes the two empty lists", async () => {
    await loadPage("options");

    expect(
      document.head
        .querySelector('link[rel="stylesheet"]')
        ?.getAttribute("href"),
    ).toBe("./ui.css");
    expect(document.title).toBe("NoAI - a less sloppier web");
    expect(element("designation-list", HTMLUListElement).textContent).toContain(
      "No personal designations yet",
    );
    expect(element("exemption-list", HTMLUListElement).textContent).toContain(
      "No personal exemptions yet",
    );
  });

  it("labels invalid input inline and focuses it without saving", async () => {
    await loadPage("options");
    const input = element("designation-channel-id", HTMLInputElement);
    input.value = "@channel-handle";
    element("designation-form", HTMLFormElement).requestSubmit();

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(input);
    expect(element("designation-status", HTMLElement).dataset.state).toBe(
      "error",
    );
    expect(addPersonalDesignation).not.toHaveBeenCalled();
    input.dispatchEvent(new Event("input"));
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("saves personal designations and exemptions through their existing actions", async () => {
    await loadPage("options");
    element("designation-channel-id", HTMLInputElement).value = channelId;
    element("designation-form", HTMLFormElement).requestSubmit();
    await vi.waitFor(() =>
      expect(element("designation-status", HTMLElement).dataset.state).toBe(
        "success",
      ),
    );

    element("exemption-channel-id", HTMLInputElement).value =
      `https://www.youtube.com/channel/${channelId}`;
    element("exemption-form", HTMLFormElement).requestSubmit();
    await vi.waitFor(() =>
      expect(element("exemption-status", HTMLElement).dataset.state).toBe(
        "success",
      ),
    );
    expect(addPersonalDesignation).toHaveBeenCalledExactlyOnceWith(channelId);
    expect(addPersonalExemption).toHaveBeenCalledExactlyOnceWith(channelId);
  });

  it("shows a hidden channel's saved name and ID", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      enabled: true,
      personalDesignations: [channelId],
      personalDesignationNames: { [channelId]: "A channel with a long name" },
      personalExemptions: [],
    });
    await loadPage("options");

    const item = element(
      "designation-list",
      HTMLUListElement,
    ).firstElementChild;
    expect(item?.querySelector("a")?.textContent).toBe(
      "A channel with a long name",
    );
    expect(item?.querySelector(".rule-channel-id")?.textContent).toBe(
      channelId,
    );
  });

  it("retains the input after a failed save and enables retry", async () => {
    vi.mocked(addPersonalDesignation).mockRejectedValueOnce(
      new Error("Write failed"),
    );
    await loadPage("options");
    const input = element("designation-channel-id", HTMLInputElement);
    input.value = channelId;
    const form = element("designation-form", HTMLFormElement);
    form.requestSubmit();

    await vi.waitFor(() =>
      expect(element("designation-status", HTMLElement).dataset.state).toBe(
        "error",
      ),
    );
    expect(input.value).toBe(channelId);
    expect(input.readOnly).toBe(false);
    form.requestSubmit();
    await vi.waitFor(() =>
      expect(element("designation-status", HTMLElement).dataset.state).toBe(
        "success",
      ),
    );
    expect(input.value).toBe("");
  });

  it("handles removal clicks on nested elements", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      enabled: true,
      personalDesignations: [channelId],
      personalDesignationNames: {},
      personalExemptions: [],
    });
    await loadPage("options");
    const button = element("designation-list", HTMLUListElement).querySelector(
      "button",
    );
    expect(button?.getAttribute("aria-label")).toContain(channelId);
    const child = document.createElement("span");
    child.textContent = "Remove";
    button?.append(child);
    child.click();

    await vi.waitFor(() =>
      expect(removePersonalDesignation).toHaveBeenCalledExactlyOnceWith(
        channelId,
      ),
    );
    expect(element("designation-status", HTMLElement).textContent).toBe(
      "Personal rule removed.",
    );
  });

  it("shows load failures rather than claiming there are no rules", async () => {
    vi.mocked(getSettings).mockRejectedValue(new Error("Storage unavailable"));
    await loadPage("options");

    expect(element("saved-status", HTMLElement).dataset.state).toBe("error");
    expect(element("designation-list", HTMLUListElement).textContent).toContain(
      "unavailable",
    );
    expect(
      element("exemption-list", HTMLUListElement).getAttribute("aria-busy"),
    ).toBe("false");
  });
});
