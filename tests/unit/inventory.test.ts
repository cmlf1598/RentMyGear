import { describe, expect, it } from "vitest";

import { CATEGORIES } from "@/config/categories";
import rawInventory from "@/data/inventory.json";
import { InventoryValidationError } from "@/lib/errors";
import { parseInventory } from "@/services/inventoryService";
import { CATEGORY_IDS } from "@/types/gear";

describe("inventory data (src/data/inventory.json)", () => {
  it("passes the inventory schema", () => {
    expect(() => parseInventory(rawInventory)).not.toThrow();
  });

  it("has a config entry for every category id, and at least one item per category", () => {
    const items = parseInventory(rawInventory);

    for (const id of CATEGORY_IDS) {
      expect(CATEGORIES[id]?.id).toBe(id);
      expect(items.filter((item) => item.category === id).length, `items in "${id}"`).toBeGreaterThan(0);
    }
  });

  it("rejects an item whose category is not registered, pointing at the offending item", () => {
    const data = structuredClone(rawInventory);
    data[3].category = "ciclismo";

    expect(() => parseInventory(data)).toThrow(InventoryValidationError);
    expect(() => parseInventory(data)).toThrow(/\[3\.category\]/);
  });

  it("rejects duplicate ids", () => {
    const data = [...rawInventory, structuredClone(rawInventory[0])];

    expect(() => parseInventory(data)).toThrow(`Duplicate inventory id "${rawInventory[0].id}"`);
  });
});
