import { isYouTubeChannelId } from "./youtube-channel";

export interface CatalogueSnapshot {
  channelIds: string[];
  version: string;
}

export const EMPTY_CATALOGUE_SNAPSHOT: CatalogueSnapshot = {
  channelIds: [],
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

  const { channelIds, version } = value;
  if (typeof version !== "string" || !isChannelIdList(channelIds)) {
    return null;
  }

  return {
    channelIds: [...new Set(channelIds)].sort(),
    version,
  };
}
