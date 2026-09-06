const channelIdPattern = /^UC[\w-]{22}$/;

export function isYouTubeChannelId(value: string): boolean {
  return channelIdPattern.test(value);
}

export function parseYouTubeChannelId(value: string): string | null {
  const input = value.trim();
  if (isYouTubeChannelId(input)) {
    return input;
  }

  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    if (
      host !== "youtube.com" &&
      host !== "www.youtube.com" &&
      host !== "m.youtube.com"
    ) {
      return null;
    }

    const match = url.pathname.match(/^\/channel\/(UC[\w-]{22})\/?$/);
    return match?.[1] && isYouTubeChannelId(match[1]) ? match[1] : null;
  } catch {
    return null;
  }
}
