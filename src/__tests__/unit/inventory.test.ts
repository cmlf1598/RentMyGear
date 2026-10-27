import { describe, expect, it } from "vitest";

import { CATEGORIES } from "../../config/categories";
import rawInventory from "../../data/inventory.json";
import { InventoryValidationError, NotFoundError } from "../../lib/errors";
import { createInventoryService, parseInventory } from "../../services/inventoryService";
import { CATEGORY_IDS } from "../../types/gear";

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

  it("serves items by id, picks distinct random items, and rejects unknown ids", () => {
    const items = parseInventory(rawInventory).slice(0, 4);
    const service = createInventoryService(items);

    expect(service.getAll()).toBe(items);
    expect(service.getById(items[2].id)).toBe(items[2]);
    expect(service.getById("nope")).toBeUndefined();
    expect(service.getRandom(2, () => 0).map((item) => item.id)).toEqual([items[0].id, items[1].id]);
    const all = service.getRandom(10);
    expect(new Set(all.map((item) => item.id)).size).toBe(4);
    expect(() => service.getAvailability("nope")).toThrow(NotFoundError);
    expect(() => service.getByIdOrThrow("nope")).toThrow(NotFoundError);
  });

  it("rejects duplicate ids", () => {
    const data = [...rawInventory, structuredClone(rawInventory[0])];

    expect(() => parseInventory(data)).toThrow(`Duplicate inventory id "${rawInventory[0].id}"`);
  });
});
