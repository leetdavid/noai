import { describe, expect, it } from "vitest";

import { isYouTubeVideoUrl } from "./youtube.js";

describe("YouTube video URLs", () => {
  it("accepts watch, Shorts, and short-link video URLs", () => {
    expect(
      isYouTubeVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe(true);
    expect(
      isYouTubeVideoUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    ).toBe(true);
    expect(isYouTubeVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("rejects channel pages and malformed video URLs", () => {
    expect(isYouTubeVideoUrl("https://www.youtube.com/watch")).toBe(false);
    expect(isYouTubeVideoUrl("https://www.youtube.com/shorts/")).toBe(false);
    expect(isYouTubeVideoUrl("https://youtu.be/not-a-video-id")).toBe(false);
  });
});
