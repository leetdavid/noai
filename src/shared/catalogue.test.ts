import { describe, expect, it } from "vitest";

import { parseCatalogueSnapshot } from "./catalogue";

const firstChannelId = "UCabcdefghijklmnopqrstuv";
const secondChannelId = "UCzyxwvutsrqponmlkjihgfe";

describe("Catalogue snapshots", () => {
  it("accepts and normalizes a public catalogue snapshot", () => {
    expect(
      parseCatalogueSnapshot({
        channelIds: [secondChannelId, firstChannelId, firstChannelId],
        version: "12",
      }),
    ).toEqual({
      channelIds: [firstChannelId, secondChannelId],
      version: "12",
    });
  });

  it("rejects malformed external data", () => {
    expect(
      parseCatalogueSnapshot({ channelIds: ["not-a-channel"], version: "1" }),
    ).toBeNull();
    expect(parseCatalogueSnapshot({ channelIds: [], version: 1 })).toBeNull();
    expect(parseCatalogueSnapshot(null)).toBeNull();
  });
});
