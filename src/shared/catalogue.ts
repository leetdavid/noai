import { isYouTubeChannelId } from "./youtube-channel";

export interface CatalogueSnapshot {
  channelIds: string[];
  trustedChannelIds: string[];
  version: string;
}

export const EMPTY_CATALOGUE_SNAPSHOT: CatalogueSnapshot = {
  channelIds: [],
  trustedChannelIds: [],
  version: "0",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChannelIdList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (channelId) =>
        typeof channelId === "string" && isYouTubeChannelId(channelId),
    )
  );
}

export function parseCatalogueSnapshot(
  value: unknown,
): CatalogueSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const { channelIds, trustedChannelIds, version } = value;
  if (typeof version !== "string" || !isChannelIdList(channelIds)) {
    return null;
  }
  if (trustedChannelIds !== undefined && !isChannelIdList(trustedChannelIds)) {
    return null;
  }

  return {
    channelIds: [...new Set(channelIds)].sort(),
    trustedChannelIds: trustedChannelIds
      ? [...new Set(trustedChannelIds)].sort()
      : [],
    version,
  };
}

export function resolveBlockedChannelIds(
  snapshot: CatalogueSnapshot,
  personalDesignations: string[],
  personalExemptions: string[],
): Set<string> {
  const blocked = new Set<string>([
    ...snapshot.channelIds,
    ...personalDesignations,
  ]);
  for (const channelId of personalExemptions) {
    blocked.delete(channelId);
  }
  for (const channelId of snapshot.trustedChannelIds) {
    blocked.delete(channelId);
  }
  return blocked;
}
