import {
  BLOCKED_CHANNELS_STORAGE_KEY,
  type BlockedChannel,
  getBlockedChannels,
} from "./shared/blocked-channels";
import { getSettings, saveSettings } from "./shared/settings";

function getElement<T extends HTMLElement>(id: string, type: { new (): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`Expected #${id} to be a ${type.name}`);
  }

  return element;
}

const enabledInput = getElement("enabled", HTMLInputElement);
const status = getElement("status", HTMLElement);
const blockedCount = getElement("blocked-count", HTMLElement);
const blockedList = getElement("blocked-list", HTMLUListElement);
const blockedMessage = getElement("blocked-message", HTMLElement);
let savingSettings = false;

function setStatus(enabled: boolean): void {
  status.textContent = enabled ? "On for YouTube" : "Paused for YouTube";
  status.dataset.state = "ready";
}

function formatBlockedTime(timestamp: number): string {
  const elapsedMinutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (elapsedMinutes < 1) {
    return "just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return elapsedHours < 24 ? `${elapsedHours}h ago` : "earlier";
}

function createBlockedChannelItem(channel: BlockedChannel): HTMLLIElement {
  const item = document.createElement("li");
  const channelLink = document.createElement("a");
  const metadata = document.createElement("div");
  const source = document.createElement("span");
  const time = document.createElement("time");

  channelLink.href = `https://www.youtube.com/channel/${channel.channelId}`;
  channelLink.target = "_blank";
  channelLink.rel = "noopener noreferrer";
  channelLink.textContent = channel.channelName;
  channelLink.title = channel.channelName;
  metadata.className = "activity-meta";
  source.className = "activity-source";
  source.dataset.source = channel.source;
  source.textContent =
    channel.source === "personal" ? "Personal rule" : "Catalogue";
  time.textContent = formatBlockedTime(channel.lastBlockedAt);
  time.title = new Date(channel.lastBlockedAt).toLocaleString();
  metadata.append(source, time);
  item.append(channelLink, metadata);
  return item;
}

function renderBlockedChannels(channels: BlockedChannel[]): void {
  blockedCount.textContent =
    channels.length === 0
      ? "No channels yet"
      : `${channels.length} ${channels.length === 1 ? "channel" : "channels"}`;
  blockedMessage.textContent =
    "Nothing filtered yet. Channels NoAI filters on YouTube will appear here.";
  blockedMessage.dataset.state = "ready";
  blockedMessage.hidden = channels.length > 0;
  blockedList.hidden = channels.length === 0;
  blockedList.replaceChildren(
    ...channels.map((channel) => createBlockedChannelItem(channel)),
  );
}

async function refreshSettings(): Promise<void> {
  if (savingSettings) {
    return;
  }

  try {
    const settings = await getSettings();
    if (!savingSettings) {
      enabledInput.checked = settings.enabled;
      enabledInput.disabled = false;
      setStatus(settings.enabled);
    }
  } catch {
    if (!savingSettings) {
      enabledInput.disabled = true;
      status.textContent = "Couldn't load settings. Reopen NoAI to retry.";
      status.dataset.state = "error";
    }
  }
}

async function refreshBlockedChannels(): Promise<void> {
  try {
    renderBlockedChannels(await getBlockedChannels());
  } catch {
    blockedCount.textContent = "Unavailable";
    blockedList.replaceChildren();
    blockedList.hidden = true;
    blockedMessage.hidden = false;
    blockedMessage.textContent =
      "Couldn't load recent activity. Reopen NoAI to try again.";
    blockedMessage.dataset.state = "error";
  } finally {
    blockedList.setAttribute("aria-busy", "false");
  }
}

enabledInput.addEventListener("change", async () => {
  const enabled = enabledInput.checked;
  savingSettings = true;
  enabledInput.disabled = true;
  status.textContent = "Saving...";
  status.dataset.state = "pending";
  try {
    await saveSettings({ enabled });
    setStatus(enabled);
  } catch {
    enabledInput.checked = !enabled;
    status.textContent = "Couldn't save. Try the switch again.";
    status.dataset.state = "error";
  } finally {
    savingSettings = false;
    enabledInput.disabled = false;
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync") {
    void refreshSettings();
  }
  if (areaName === "local" && BLOCKED_CHANNELS_STORAGE_KEY in changes) {
    void refreshBlockedChannels();
  }
});

void refreshSettings();
void refreshBlockedChannels();
