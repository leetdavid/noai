import type { BlockedChannelSource } from "./blocked-channels";
import { type CatalogueSnapshot, parseCatalogueSnapshot } from "./catalogue";
import { isYouTubeChannelId } from "./youtube-channel";

export const CATALOGUE_REQUEST_KIND = "noai:catalogue-request";
export const CATALOGUE_RESPONSE_KIND = "noai:catalogue-response";
export const BLOCKED_CHANNEL_KIND = "noai:blocked-channel";
export const CATALOGUE_CACHE_KEY = "catalogue-cache";

export interface CatalogueRequest {
  kind: typeof CATALOGUE_REQUEST_KIND;
  forceRefresh?: boolean;
}

export interface CatalogueResponse {
  kind: typeof CATALOGUE_RESPONSE_KIND;
  snapshot: CatalogueSnapshot;
}

export interface BlockedChannelMessage {
  channelId: string;
  channelName: string;
  kind: typeof BLOCKED_CHANNEL_KIND;
  source: BlockedChannelSource;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCatalogueRequest(value: unknown): value is CatalogueRequest {
  return (
    isRecord(value) &&
    value.kind === CATALOGUE_REQUEST_KIND &&
    (value.forceRefresh === undefined ||
      typeof value.forceRefresh === "boolean")
  );
}

export function isCatalogueResponse(
  value: unknown,
): value is CatalogueResponse {
  return (
    isRecord(value) &&
    value.kind === CATALOGUE_RESPONSE_KIND &&
    parseCatalogueSnapshot(value.snapshot) !== null
  );
}

export function isBlockedChannelMessage(
  value: unknown,
): value is BlockedChannelMessage {
  return (
    isRecord(value) &&
    value.kind === BLOCKED_CHANNEL_KIND &&
    typeof value.channelId === "string" &&
    isYouTubeChannelId(value.channelId) &&
    typeof value.channelName === "string" &&
    value.channelName.length > 0 &&
    (value.source === "catalogue" || value.source === "personal")
  );
}
