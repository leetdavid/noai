import { type CatalogueSnapshot, parseCatalogueSnapshot } from "./catalogue";

export const CATALOGUE_REQUEST_KIND = "noai:catalogue-request";
export const CATALOGUE_RESPONSE_KIND = "noai:catalogue-response";

export interface CatalogueRequest {
  kind: typeof CATALOGUE_REQUEST_KIND;
}

export interface CatalogueResponse {
  kind: typeof CATALOGUE_RESPONSE_KIND;
  snapshot: CatalogueSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCatalogueRequest(value: unknown): value is CatalogueRequest {
  return isRecord(value) && value.kind === CATALOGUE_REQUEST_KIND;
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
