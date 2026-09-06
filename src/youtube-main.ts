import { YOUTUBE_CHANNEL_ATTRIBUTE } from "./shared/youtube-card";
import { isYouTubeChannelId } from "./shared/youtube-channel";

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
    for (const item of value) {
      const channelId = findChannelId(item, depth + 1, seen);
      if (channelId) {
        return channelId;
      }
    }
    return null;
  }

  if (!isRecord(value) || seen.has(value)) {
    return null;
  }

  seen.add(value);
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

function getElementData(element: HTMLElement): unknown {
  return "data" in element ? element.data : null;
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

function scheduleAnnotation(): void {
  if (filteringScheduled) {
    return;
  }

  filteringScheduled = true;
  requestAnimationFrame(() => {
    filteringScheduled = false;
    annotateCards();
  });
}

const observer = new MutationObserver(scheduleAnnotation);

observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("yt-navigate-finish", scheduleAnnotation);
window.addEventListener("yt-page-data-updated", scheduleAnnotation);
scheduleAnnotation();
