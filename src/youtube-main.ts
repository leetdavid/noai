import {
  YOUTUBE_CHANNEL_ATTRIBUTE,
  YOUTUBE_CURRENT_CHANNEL_ATTRIBUTE,
} from "./shared/youtube-card";
import {
  isYouTubeChannelId,
  parseYouTubeChannelId,
} from "./shared/youtube-channel";

const cardSelector = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-playlist-video-renderer",
].join(",");
const dataSelector = [
  "ytd-rich-grid-media",
  "ytd-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-playlist-video-renderer",
].join(",");

let filteringScheduled = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findChannelIdInValues(
  values: unknown[],
  depth: number,
  seen: Set<object>,
): string | null {
  for (const value of values) {
    const channelId = findChannelId(value, depth + 1, seen);
    if (channelId) {
      return channelId;
    }
  }

  return null;
}

function findChannelIdInRecord(
  value: Record<string, unknown>,
  depth: number,
  seen: Set<object>,
): string | null {
  for (const [key, item] of Object.entries(value)) {
    if (
      (key === "browseId" || key === "channelId") &&
      typeof item === "string" &&
      isYouTubeChannelId(item)
    ) {
      return item;
    }

    const channelId = findChannelId(item, depth + 1, seen);
    if (channelId) {
      return channelId;
    }
  }

  return null;
}

function findChannelId(
  value: unknown,
  depth = 0,
  seen = new Set<object>(),
): string | null {
  if (depth > 8) {
    return null;
  }

  if (typeof value === "string") {
    return isYouTubeChannelId(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return findChannelIdInValues(value, depth, seen);
  }

  if (!isRecord(value) || seen.has(value)) {
    return null;
  }

  seen.add(value);
  return findChannelIdInRecord(value, depth, seen);
}

function getElementData(element: HTMLElement): unknown {
  return "data" in element ? element.data : null;
}

function getElementPlayerData(element: HTMLElement): unknown {
  return "playerData" in element ? element.playerData : null;
}

function getChannelId(card: HTMLElement): string | null {
  const channelLink = card.querySelector<HTMLAnchorElement>(
    "a[href^='/channel/UC']",
  );
  const directMatch = channelLink
    ?.getAttribute("href")
    ?.match(/^\/channel\/(UC[\w-]{22})/);
  if (directMatch?.[1] && isYouTubeChannelId(directMatch[1])) {
    return directMatch[1];
  }

  const elements = [card, ...card.querySelectorAll<HTMLElement>(dataSelector)];
  for (const element of elements) {
    const channelId = findChannelId(getElementData(element));
    if (channelId) {
      return channelId;
    }
  }

  return null;
}

function isVideoPage(): boolean {
  return (
    location.pathname === "/watch" ||
    location.pathname.startsWith("/shorts/") ||
    location.pathname.startsWith("/live/")
  );
}

function isChannelPage(): boolean {
  return (
    location.pathname.startsWith("/@") ||
    location.pathname.startsWith("/channel/") ||
    location.pathname.startsWith("/c/") ||
    location.pathname.startsWith("/user/")
  );
}

function getCurrentVideoChannelId(): string | null {
  for (const element of document.querySelectorAll<HTMLElement>(
    "ytd-watch-flexy, ytd-player",
  )) {
    const channelId =
      findChannelId(getElementPlayerData(element)) ??
      findChannelId(getElementData(element));
    if (channelId) {
      return channelId;
    }
  }

  return null;
}

function getCurrentChannelId(): string | null {
  if (isVideoPage()) {
    return getCurrentVideoChannelId();
  }

  if (!isChannelPage()) {
    return null;
  }

  const canonicalUrl = document.querySelector<HTMLLinkElement>(
    "link[rel='canonical']",
  )?.href;
  if (canonicalUrl) {
    const channelId = parseYouTubeChannelId(canonicalUrl);
    if (channelId) {
      return channelId;
    }
  }

  const browse = document.querySelector<HTMLElement>("ytd-browse");
  return browse ? findChannelId(getElementData(browse)) : null;
}

function annotateCards(): void {
  for (const card of document.querySelectorAll<HTMLElement>(cardSelector)) {
    const channelId = getChannelId(card);
    if (channelId) {
      card.setAttribute(YOUTUBE_CHANNEL_ATTRIBUTE, channelId);
    } else {
      card.removeAttribute(YOUTUBE_CHANNEL_ATTRIBUTE);
    }
  }
}

function annotateCurrentChannel(): void {
  const channelId = getCurrentChannelId();
  if (channelId) {
    document.documentElement.setAttribute(
      YOUTUBE_CURRENT_CHANNEL_ATTRIBUTE,
      channelId,
    );
  } else {
    document.documentElement.removeAttribute(YOUTUBE_CURRENT_CHANNEL_ATTRIBUTE);
  }
}

function annotateYouTube(): void {
  annotateCards();
  annotateCurrentChannel();
}

function scheduleAnnotation(): void {
  if (filteringScheduled) {
    return;
  }

  filteringScheduled = true;
  requestAnimationFrame(() => {
    filteringScheduled = false;
    annotateYouTube();
  });
}

const observer = new MutationObserver(scheduleAnnotation);

observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("yt-navigate-start", () => {
  document.documentElement.removeAttribute(YOUTUBE_CURRENT_CHANNEL_ATTRIBUTE);
});
window.addEventListener("yt-navigate-finish", scheduleAnnotation);
window.addEventListener("yt-page-data-updated", scheduleAnnotation);
scheduleAnnotation();
