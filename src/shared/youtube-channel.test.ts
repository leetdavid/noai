import { describe, expect, it } from "vitest";

import { isYouTubeChannelId, parseYouTubeChannelId } from "./youtube-channel";

const channelId = "UCabcdefghijklmnopqrstuv";

describe("YouTube Channel IDs", () => {
  it("accepts immutable YouTube channel IDs", () => {
    expect(isYouTubeChannelId(channelId)).toBe(true);
    expect(parseYouTubeChannelId(channelId)).toBe(channelId);
  });

  it("extracts the channel ID from canonical YouTube URLs", () => {
    expect(
      parseYouTubeChannelId(`https://www.youtube.com/channel/${channelId}`),
    ).toBe(channelId);
    expect(
      parseYouTubeChannelId(`https://m.youtube.com/channel/${channelId}/`),
    ).toBe(channelId);
  });

  it("rejects handles, malformed IDs, and non-YouTube URLs", () => {
    expect(parseYouTubeChannelId("@not-a-channel-id")).toBeNull();
    expect(parseYouTubeChannelId("UCtoo-short")).toBeNull();
    expect(
      parseYouTubeChannelId(`https://example.com/channel/${channelId}`),
    ).toBeNull();
  });
});
