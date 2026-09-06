const channelIdPattern = /^UC[\w-]{22}$/;
const videoIdPattern = /^[\w-]{11}$/;

export function isYouTubeChannelId(value: string): boolean {
  return channelIdPattern.test(value);
}

export function isYouTubeVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isYouTubeHost =
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be";

    if (!isYouTubeHost) {
      return false;
    }

    if (host === "youtu.be") {
      return videoIdPattern.test(url.pathname.slice(1));
    }

    if (url.pathname === "/watch") {
      return videoIdPattern.test(url.searchParams.get("v") ?? "");
    }

    const shortMatch = url.pathname.match(/^\/shorts\/([\w-]{11})$/);
    return shortMatch?.[1] ? videoIdPattern.test(shortMatch[1]) : false;
  } catch {
    return false;
  }
}
