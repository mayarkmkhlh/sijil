import { catalog, matchCatalog, reviewItem } from "@sijil/shared";
import { describe, expect, it } from "vitest";

describe("matchCatalog", () => {
  it("matches a longer gulf name to the catalog entry", () => {
    expect(matchCatalog("كيكة شوكولاتة كبيرة", catalog)?.id).toBe("cake-chocolate");
  });

  it("matches an english alias", () => {
    expect(matchCatalog("chocolate cake", catalog)?.id).toBe("cake-chocolate");
    expect(matchCatalog("2 boxes of sukkari dates", catalog)?.id).toBe("sukkari-dates");
  });

  it("treats alef variants and ta marbuta as the same letters", () => {
    expect(matchCatalog("كيكة شوكولاته", catalog)?.id).toBe("cake-chocolate");
  });

  it("returns null when nothing in the catalog fits", () => {
    expect(matchCatalog("باقة ورد", catalog)).toBeNull();
  });

  it("flags a matching name whose price disagrees", () => {
    const review = reviewItem("كيكة شوكولاتة", 1);
    expect(review.status).toBe("price_mismatch");
    expect(review.catalogPrice).toBe(120);
  });

  it("fills nothing for an unknown line", () => {
    expect(reviewItem("باقة ورد", 90)).toEqual({
      status: "unknown",
      catalogId: null,
      catalogName: null,
      catalogPrice: null,
      quotedPrice: 90,
    });
  });
});
