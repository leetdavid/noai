import {
  EMPTY_CATALOGUE_SNAPSHOT,
  resolveBlockedChannelIds,
} from "./shared/catalogue";
import {
  BLOCKED_CHANNEL_KIND,
  CATALOGUE_REQUEST_KIND,
  isCatalogueResponse,
} from "./shared/messages";
import { addPersonalDesignation, getSettings } from "./shared/settings";
import {
  YOUTUBE_CHANNEL_ATTRIBUTE,
  YOUTUBE_CURRENT_CHANNEL_ATTRIBUTE,
  YOUTUBE_HIDDEN_ATTRIBUTE,
} from "./shared/youtube-card";

const hiddenStyleId = "noai-youtube-hidden-content-style";
const channelActionStyleId = "noai-youtube-channel-action-style";
const channelActionId = "noai-youtube-channel-action";

let blockedChannelIds = new Set<string>();
let catalogueChannelIds = new Set<string>();
let trustedChannelIds = new Set<string>();
let personalDesignationIds = new Set<string>();
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

function installChannelActionStyle(): void {
  if (document.getElementById(channelActionStyleId)) {
    return;
  }

  const style = document.createElement("style");
  style.id = channelActionStyleId;
  style.textContent = `
    #${channelActionId} {
      --noai-action-ink: #315a46;
      --noai-action-bg: #e5ecdf;
      --noai-action-hover: #d8e3d1;
      --noai-action-line: #c4d3bb;
      align-items: center;
      display: inline-flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 4px 8px;
      max-width: 100%;
    }
    html[dark] #${channelActionId} {
      --noai-action-ink: #d1e3cd;
      --noai-action-bg: #26382d;
      --noai-action-hover: #334a3b;
      --noai-action-line: #526951;
    }
    #${channelActionId} [data-noai-channel-indicator],
    #${channelActionId} button {
      border: 1px solid var(--noai-action-line);
      border-radius: 18px;
      box-sizing: border-box;
      color: var(--noai-action-ink);
      font-family: Roboto, Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
      min-height: 36px;
      padding: 7px 14px;
      text-align: center;
    }
    #${channelActionId} [data-noai-channel-indicator] {
      background: var(--noai-action-bg);
    }
    #${channelActionId} button {
      background: transparent;
      cursor: pointer;
      transition: background 140ms ease;
    }
    #${channelActionId} button:hover {
      background: var(--noai-action-hover);
    }
    #${channelActionId} button:focus-visible {
      background: var(--noai-action-hover);
      outline: 2px solid var(--noai-action-ink);
      outline-offset: 3px;
    }
    #${channelActionId} button:disabled {
      cursor: wait;
      opacity: 0.65;
    }
    @media (prefers-reduced-motion: reduce) {
      #${channelActionId} button {
        transition: none;
      }
    }
  `;
  document.documentElement.append(style);
}

function isVideoPage(): boolean {
  return (
    location.pathname === "/watch" ||
    location.pathname.startsWith("/shorts/") ||
    location.pathname.startsWith("/live/")
  );
}

function getChannelActionTarget(): HTMLElement | null {
  if (isVideoPage()) {
    return document.querySelector<HTMLElement>("ytd-watch-metadata #owner");
  }

  return document.querySelector<HTMLElement>(
    "yt-flexible-actions-view-model, ytd-c4-tabbed-header-renderer #buttons, ytd-channel-header-renderer #buttons",
  );
}

function getReviewSubmissionUrl(channelId: string): string {
  const url = new URL("https://noai.eslee.io/submit");
  url.searchParams.set("channelId", channelId);
  if (isVideoPage()) {
    url.searchParams.set("videoUrl", location.href);
  }

  return url.toString();
}

function getWhitelistSubmissionUrl(channelId: string): string {
  const url = new URL("https://noai.eslee.io/submit");
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("kind", "allowlist");
  if (isVideoPage()) {
    url.searchParams.set("videoUrl", location.href);
  }

  return url.toString();
}

function renderChannelAction(): void {
  const channelId = document.documentElement.getAttribute(
    YOUTUBE_CURRENT_CHANNEL_ATTRIBUTE,
  );
  const target = getChannelActionTarget();
  const existingAction = document.getElementById(channelActionId);
  if (!channelId || !target) {
    existingAction?.remove();
    return;
  }

  const isTrusted = trustedChannelIds.has(channelId);
  const isSlopChannel =
    !isTrusted &&
    (catalogueChannelIds.has(channelId) ||
      personalDesignationIds.has(channelId));
  const isFiltered = blockedChannelIds.has(channelId);
  const state = `${channelId}:${isTrusted}:${isSlopChannel}:${isFiltered}`;
  if (
    existingAction?.parentElement === target &&
    existingAction.dataset.state === state
  ) {
    return;
  }

  existingAction?.remove();
  const action = document.createElement("span");
  action.id = channelActionId;
  action.dataset.state = state;

  if (isTrusted) {
    const indicator = document.createElement("span");
    indicator.dataset.noaiChannelIndicator = "";
    indicator.textContent = "NoAI: trusted channel";
    action.append(indicator);
  } else {
    if (isSlopChannel) {
      const indicator = document.createElement("span");
      indicator.dataset.noaiChannelIndicator = "";
      indicator.textContent = "NoAI: AI slop channel";
      action.append(indicator);
    }

    if (!isFiltered) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Hide as AI slop";
      button.addEventListener("click", () => {
        button.disabled = true;
        void addPersonalDesignation(channelId, getCurrentChannelName())
          .then(refreshFilters)
          .catch(() => {
            button.disabled = false;
          });
      });
      action.append(button);
    }
  }

  if (!isTrusted && !catalogueChannelIds.has(channelId)) {
    const submitButton = document.createElement("button");
    submitButton.type = "button";
    submitButton.textContent = "Submit for review";
    submitButton.addEventListener("click", () => {
      window.open(getReviewSubmissionUrl(channelId), "_blank", "noopener");
    });
    action.append(submitButton);
  }

  if (!isTrusted) {
    const whitelistButton = document.createElement("button");
    whitelistButton.type = "button";
    whitelistButton.textContent = "Submit for whitelist";
    whitelistButton.addEventListener("click", () => {
      window.open(getWhitelistSubmissionUrl(channelId), "_blank", "noopener");
    });
    action.append(whitelistButton);
  }

  target.append(action);
}

function getCurrentChannelName(): string | null {
  const selector = isVideoPage()
    ? "ytd-watch-metadata #owner #channel-name a"
    : "ytd-channel-name yt-formatted-string";
  const channelName = document
    .querySelector<HTMLElement>(selector)
    ?.textContent?.trim();
  return channelName || null;
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
    const isBlocked = channelId !== null && blockedChannelIds.has(channelId);
    const wasBlocked = card.hasAttribute(YOUTUBE_HIDDEN_ATTRIBUTE);
    card.toggleAttribute(YOUTUBE_HIDDEN_ATTRIBUTE, isBlocked);
    if (channelId && isBlocked && !wasBlocked) {
      void chrome.runtime.sendMessage({
        channelId,
        channelName: getChannelName(card, channelId),
        kind: BLOCKED_CHANNEL_KIND,
        source: personalDesignationIds.has(channelId)
          ? "personal"
          : "catalogue",
      });
    }
  }

  renderChannelAction();
}

function getChannelName(card: HTMLElement, channelId: string): string {
  const channelName = card
    .querySelector<HTMLElement>("#channel-name a, ytd-channel-name a")
    ?.textContent?.trim();
  return channelName || channelId;
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

  catalogueChannelIds = new Set(snapshot.channelIds);
  trustedChannelIds = new Set(snapshot.trustedChannelIds);
  personalDesignationIds = new Set(settings.personalDesignations);
  blockedChannelIds = resolveBlockedChannelIds(
    snapshot,
    settings.personalDesignations,
    settings.personalExemptions,
  );

  applyFilter();
}

const observer = new MutationObserver(() => {
  scheduleFilter();
});

installHiddenStyle();
installChannelActionStyle();
observer.observe(document.documentElement, {
  attributeFilter: [
    YOUTUBE_CHANNEL_ATTRIBUTE,
    YOUTUBE_CURRENT_CHANNEL_ATTRIBUTE,
  ],
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
