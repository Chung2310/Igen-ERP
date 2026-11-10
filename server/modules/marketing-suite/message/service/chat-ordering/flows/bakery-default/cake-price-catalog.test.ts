import { describe, expect, it } from "vitest";
import { matchesCakeType, parseCakePriceCatalog, resolveCakeChoice } from "./cake-price-catalog";

describe("parseCakePriceCatalog", () => {
  it("reads the Vibary narrative price list into orderable variants", () => {
    const catalog = parseCakePriceCatalog([
      "* **Bánh tròn thường & Bông lan trứng muối:** Size 5cm giá 65k, size 18cm cao 7cm giá 270k, size 18cm cao 10cm giá 330k.",
      "* **Set bánh đặc biệt:** Set 4 cốc tim giá 150k, set 6 cốc tròn giá 300k, Su Singapore 12 cái giá 230k.",
      "* **Bánh Mousse & Tiramisu:** Mousse chanh leo, việt quất, dâu size 20cm giá 250k; Tiramisu size 22cm cao 7cm giá 400k.",
    ].join("\n"));

    expect(resolveCakeChoice(catalog, { groupId: "VIBARY-SALTED-EGG", size: "5", height: null, budget: 65_000, packQuantity: null, name: "Bông lan trứng muối" })).toHaveLength(1);
    expect(resolveCakeChoice(catalog, { groupId: "VIBARY-ROUND", size: "18", height: 7, budget: 270_000, packQuantity: null, name: "Bánh tròn thường" })).toHaveLength(1);
    expect(catalog.filter(variant => variant.groupId === "VIBARY-SET").map(variant => variant.price)).toEqual([150_000, 300_000, 230_000]);
    expect(catalog.filter(variant => variant.groupId === "VIBARY-MOUSSE").map(variant => variant.name)).toEqual([
      "Mousse chanh leo", "Mousse việt quất", "Mousse dâu",
    ]);
    expect(matchesCakeType(catalog.find(variant => variant.groupId === "VIBARY-SALTED-EGG")!, "bông lan trứng muối")).toBe(true);
  });
});
