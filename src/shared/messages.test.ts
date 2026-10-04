import { describe, expect, it } from "vitest";

import {
  CATALOGUE_CACHE_KEY,
  CATALOGUE_REQUEST_KIND,
  isCatalogueRequest,
} from "./messages";

describe("Catalogue requests", () => {
  it("accepts plain and force-refresh requests", () => {
    expect(isCatalogueRequest({ kind: CATALOGUE_REQUEST_KIND })).toBe(true);
    expect(
      isCatalogueRequest({
        kind: CATALOGUE_REQUEST_KIND,
        forceRefresh: true,
      }),
    ).toBe(true);
  });

  it("rejects malformed requests", () => {
    expect(isCatalogueRequest(null)).toBe(false);
    expect(isCatalogueRequest({ kind: "noai:other" })).toBe(false);
    expect(
      isCatalogueRequest({
        kind: CATALOGUE_REQUEST_KIND,
        forceRefresh: "yes",
      }),
    ).toBe(false);
  });

  it("shares one cache key between background and content", () => {
    expect(CATALOGUE_CACHE_KEY).toBe("catalogue-cache");
  });
});
