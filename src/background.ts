import {
  type CatalogueSnapshot,
  EMPTY_CATALOGUE_SNAPSHOT,
  parseCatalogueSnapshot,
} from "./shared/catalogue";
import { CATALOGUE_RESPONSE_KIND, isCatalogueRequest } from "./shared/messages";

const catalogueUrl = "https://api.noai.eslee.io/v1/catalogue";
const cacheKey = "catalogue-cache";
const refreshIntervalMs = 60 * 60 * 1000;

let catalogueRequest: Promise<CatalogueSnapshot> | null = null;

interface CatalogueCache {
  fetchedAt: number;
  snapshot: CatalogueSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCatalogueCache(value: unknown): CatalogueCache | null {
  if (!isRecord(value)) {
    return null;
  }

  const { fetchedAt, snapshot } = value;
  const parsedSnapshot = parseCatalogueSnapshot(snapshot);
  if (
    typeof fetchedAt !== "number" ||
    !Number.isFinite(fetchedAt) ||
    !parsedSnapshot
  ) {
    return null;
  }

  return { fetchedAt, snapshot: parsedSnapshot };
}

async function getCachedCatalogue(): Promise<CatalogueCache | null> {
  const stored = await chrome.storage.local.get(cacheKey);
  return parseCatalogueCache(stored[cacheKey]);
}

async function fetchCatalogue(): Promise<CatalogueSnapshot> {
  const response = await fetch(catalogueUrl);
  if (!response.ok) {
    throw new Error(`Catalogue request failed with ${response.status}`);
  }

  const snapshot = parseCatalogueSnapshot(await response.json());
  if (!snapshot) {
    throw new Error("Catalogue response was invalid");
  }

  await chrome.storage.local.set({
    [cacheKey]: {
      fetchedAt: Date.now(),
      snapshot,
    },
  });
  return snapshot;
}

async function getCatalogue(): Promise<CatalogueSnapshot> {
  const cached = await getCachedCatalogue();
  if (cached && Date.now() - cached.fetchedAt < refreshIntervalMs) {
    return cached.snapshot;
  }

  if (!catalogueRequest) {
    catalogueRequest = fetchCatalogue().finally(() => {
      catalogueRequest = null;
    });
  }

  try {
    return await catalogueRequest;
  } catch {
    return cached?.snapshot ?? EMPTY_CATALOGUE_SNAPSHOT;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isCatalogueRequest(message)) {
    return;
  }

  void getCatalogue().then((snapshot) => {
    sendResponse({
      kind: CATALOGUE_RESPONSE_KIND,
      snapshot,
    });
  });
  return true;
});
