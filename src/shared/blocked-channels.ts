export type BlockedChannelSource = "catalogue" | "personal";

export interface BlockedChannel {
  channelId: string;
  channelName: string;
  lastBlockedAt: number;
  source: BlockedChannelSource;
}

export const BLOCKED_CHANNELS_STORAGE_KEY = "blocked-channels";

const maximumRecentChannels = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBlockedChannelSource(value: unknown): value is BlockedChannelSource {
  return value === "catalogue" || value === "personal";
}

function isBlockedChannel(value: unknown): value is BlockedChannel {
  return (
    isRecord(value) &&
    typeof value.channelId === "string" &&
    typeof value.channelName === "string" &&
    typeof value.lastBlockedAt === "number" &&
    Number.isFinite(value.lastBlockedAt) &&
    isBlockedChannelSource(value.source)
  );
}

function parseBlockedChannels(value: unknown): BlockedChannel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isBlockedChannel)
    .sort((left, right) => right.lastBlockedAt - left.lastBlockedAt)
    .slice(0, maximumRecentChannels);
}

export async function getBlockedChannels(): Promise<BlockedChannel[]> {
  const stored = await chrome.storage.local.get(BLOCKED_CHANNELS_STORAGE_KEY);
  return parseBlockedChannels(stored[BLOCKED_CHANNELS_STORAGE_KEY]);
}

export async function recordBlockedChannel({
  channelId,
  channelName,
  source,
}: Pick<
  BlockedChannel,
  "channelId" | "channelName" | "source"
>): Promise<void> {
  const channels = await getBlockedChannels();
  const blockedChannel: BlockedChannel = {
    channelId,
    channelName,
    lastBlockedAt: Date.now(),
    source,
  };

  await chrome.storage.local.set({
    [BLOCKED_CHANNELS_STORAGE_KEY]: [
      blockedChannel,
      ...channels.filter((channel) => channel.channelId !== channelId),
    ].slice(0, maximumRecentChannels),
  });
}
