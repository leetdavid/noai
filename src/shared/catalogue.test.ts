import { describe, expect, it } from "vitest";

import { parseCatalogueSnapshot, resolveBlockedChannelIds } from "./catalogue";

const firstChannelId = "UCabcdefghijklmnopqrstuv";
const secondChannelId = "UCzyxwvutsrqponmlkjihgfe";

describe("Catalogue snapshots", () => {
  it("accepts and normalizes a public catalogue snapshot", () => {
    expect(
      parseCatalogueSnapshot({
        channelIds: [secondChannelId, firstChannelId, firstChannelId],
        trustedChannelIds: [secondChannelId, secondChannelId],
        version: "12",
      }),
    ).toEqual({
      channelIds: [firstChannelId, secondChannelId],
      trustedChannelIds: [secondChannelId],
      version: "12",
    });
  });

  it("defaults trusted channels for older snapshots", () => {
    expect(
      parseCatalogueSnapshot({
        channelIds: [firstChannelId],
        version: "12",
      }),
    ).toEqual({
      channelIds: [firstChannelId],
      trustedChannelIds: [],
      version: "12",
    });
  });

  it("rejects malformed external data", () => {
    expect(
      parseCatalogueSnapshot({ channelIds: ["not-a-channel"], version: "1" }),
    ).toBeNull();
    expect(parseCatalogueSnapshot({ channelIds: [], version: 1 })).toBeNull();
    expect(
      parseCatalogueSnapshot({
        channelIds: [],
        trustedChannelIds: ["not-a-channel"],
        version: "1",
      }),
    ).toBeNull();
    expect(parseCatalogueSnapshot(null)).toBeNull();
  });

  it("never blocks trusted channels, even with catalogue or personal rules", () => {
    const snapshot = {
      channelIds: [firstChannelId],
      trustedChannelIds: [firstChannelId, secondChannelId],
      version: "3",
    };
    expect(resolveBlockedChannelIds(snapshot, [secondChannelId], [])).toEqual(
      new Set(),
    );
    expect(
      resolveBlockedChannelIds(
        { channelIds: [firstChannelId], trustedChannelIds: [], version: "3" },
        [],
        [firstChannelId],
      ),
    ).toEqual(new Set());
    expect(
      resolveBlockedChannelIds(
        { channelIds: [firstChannelId], trustedChannelIds: [], version: "3" },
        [secondChannelId],
        [],
      ),
    ).toEqual(new Set([firstChannelId, secondChannelId]));
  });
});
