// @vitest-environment jsdom

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { HomeApp } from "./home";

const channelId = "UCabcdefghijklmnopqrstuv";
const fetchMock = vi.fn<typeof fetch>();
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock
    .mockReset()
    .mockResolvedValue(
      Response.json({ version: "7", channelIds: [channelId] }),
    );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render() {
  await act(async () => root.render(<HomeApp />));
}

function button(selector: string) {
  const element = container.querySelector(selector);
  if (!(element instanceof HTMLButtonElement)) throw new Error(selector);
  return element;
}

async function search(value: string) {
  const input = container.querySelector("#catalogue-query");
  const form = container.querySelector(".lookup-form");
  if (!(input instanceof HTMLInputElement) || !form)
    throw new Error("No lookup form");
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}

it("uses the requested tagline and keeps feed examples separate from real data", async () => {
  await render();
  expect(container.querySelector("h1")?.textContent).toBe(
    "NoAI - a less sloppier web",
  );
  expect(container.querySelectorAll(".preview-video")).toHaveLength(2);
  await act(async () => button(".preview-switch").click());
  expect(container.querySelectorAll(".preview-video")).toHaveLength(3);
  await act(async () => button(".preview-switch").click());
  expect(container.querySelectorAll(".preview-video")).toHaveLength(2);
  expect(container.querySelector("figcaption")?.textContent).toContain(
    "Just an example",
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("checks canonical IDs locally against the public snapshot", async () => {
  await render();
  await search(`https://www.youtube.com/channel/${channelId}`);
  expect(container.querySelector(".lookup-result")?.textContent).toContain(
    "is in the public catalogue",
  );
  await search("UCzyxwvutsrqponmlkjihgfe");
  expect(container.querySelector(".lookup-result")?.textContent).toContain(
    "isn't in the public catalogue",
  );
  await search("@some-handle");
  expect(container.querySelector(".lookup-result")?.textContent).toContain(
    "@handles aren't supported",
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("recognizes whitelisted channels and shows the whitelist count", async () => {
  const trustedId = "UCzyxwvutsrqponmlkjihgfe";
  fetchMock.mockResolvedValueOnce(
    Response.json({
      version: "8",
      channelIds: [channelId],
      trustedChannelIds: [trustedId],
    }),
  );
  await render();
  expect(container.textContent).toContain("whitelisted");
  await search(`https://www.youtube.com/channel/${trustedId}`);
  expect(container.querySelector(".lookup-result")?.textContent).toContain(
    "never filters it",
  );
});

it("recovers from unavailable catalogue data without showing a fake count", async () => {
  fetchMock.mockRejectedValueOnce(new TypeError("Offline"));
  await render();
  expect(container.textContent).toContain("We couldn't reach the catalogue");
  expect(container.querySelector(".catalogue-number")).toBeNull();
  await act(async () => button(".catalogue-error button").click());
  expect(container.textContent).toContain("1 designated channel");
  expect(fetchMock.mock.calls.at(-1)?.[1]?.cache).toBe("reload");
});

it("links to real installation instructions, review, and maintainer workflows", async () => {
  await render();
  expect(container.querySelector('a[href="#install"]')).not.toBeNull();
  expect(container.querySelector("#install")?.textContent).toContain(
    "no Web Store listing yet",
  );
  expect(container.querySelector('a[href="/submit"]')).not.toBeNull();
  expect(container.querySelector('a[href="/maintain"]')).not.toBeNull();
});
