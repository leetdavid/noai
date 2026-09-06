import { EMPTY_CATALOGUE_SNAPSHOT } from "./shared/catalogue";
import { CATALOGUE_REQUEST_KIND, isCatalogueResponse } from "./shared/messages";
import { getSettings } from "./shared/settings";
import {
  YOUTUBE_CHANNEL_ATTRIBUTE,
  YOUTUBE_HIDDEN_ATTRIBUTE,
} from "./shared/youtube-card";

const hiddenStyleId = "noai-youtube-hidden-content-style";

let blockedChannelIds = new Set<string>();
let refreshVersion = 0;
let filteringScheduled = false;

function installHiddenStyle(): void {
  if (document.getElementById(hiddenStyleId)) {
    return;
  }

  const style = document.createElement("style");
  style.id = hiddenStyleId;
  style.textContent = `[${YOUTUBE_HIDDEN_ATTRIBUTE}] { display: none !important; }`;
  document.documentElement.append(style);
}

function applyFilter(): void {
  for (const card of document.querySelectorAll<HTMLElement>(
    `[${YOUTUBE_HIDDEN_ATTRIBUTE}]`,
  )) {
    const channelId = card.getAttribute(YOUTUBE_CHANNEL_ATTRIBUTE);
    if (channelId === null || !blockedChannelIds.has(channelId)) {
      card.removeAttribute(YOUTUBE_HIDDEN_ATTRIBUTE);
    }
  }

  for (const card of document.querySelectorAll<HTMLElement>(
    `[${YOUTUBE_CHANNEL_ATTRIBUTE}]`,
  )) {
    const channelId = card.getAttribute(YOUTUBE_CHANNEL_ATTRIBUTE);
    card.toggleAttribute(
      YOUTUBE_HIDDEN_ATTRIBUTE,
      channelId !== null && blockedChannelIds.has(channelId),
    );
  }
}

function scheduleFilter(): void {
  if (filteringScheduled) {
    return;
  }

  filteringScheduled = true;
  requestAnimationFrame(() => {
    filteringScheduled = false;
    applyFilter();
  });
}

async function getCatalogue() {
  try {
    const response: unknown = await chrome.runtime.sendMessage({
      kind: CATALOGUE_REQUEST_KIND,
    });
    return isCatalogueResponse(response)
      ? response.snapshot
      : EMPTY_CATALOGUE_SNAPSHOT;
  } catch {
    return EMPTY_CATALOGUE_SNAPSHOT;
  }
}

async function refreshFilters(): Promise<void> {
  const version = ++refreshVersion;
  const settings = await getSettings();
  const snapshot = settings.enabled
    ? await getCatalogue()
    : EMPTY_CATALOGUE_SNAPSHOT;
  if (version !== refreshVersion) {
    return;
  }

  blockedChannelIds = new Set([
    ...snapshot.channelIds,
    ...settings.personalDesignations,
  ]);
  for (const channelId of settings.personalExemptions) {
    blockedChannelIds.delete(channelId);
  }

  applyFilter();
}

const observer = new MutationObserver(() => {
  scheduleFilter();
});

installHiddenStyle();
observer.observe(document.documentElement, {
  attributeFilter: [YOUTUBE_CHANNEL_ATTRIBUTE],
  attributes: true,
  childList: true,
  subtree: true,
});
chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === "sync") {
    void refreshFilters();
  }
});

void refreshFilters();
