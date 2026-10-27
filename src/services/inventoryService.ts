import rawInventory from "../data/inventory.json";
import { resolveBookedRanges } from "../lib/date-utils";
import { InventoryValidationError, NotFoundError } from "../lib/errors";
import { InventorySchema, type BookedRange, type CategoryId, type GearItem } from "../types/gear";

export interface InventoryService {
  getAll(): GearItem[];
  getById(id: string): GearItem | undefined;
  /** Like getById but throws NotFoundError — handy in route handlers. */
  getByIdOrThrow(id: string): GearItem;
  getByCategory(category: CategoryId): GearItem[];
  countByCategory(): Record<CategoryId, number>;
  getRandom(count: number, rng?: () => number): GearItem[];
  getAvailability(id: string, now?: Date): BookedRange[];
}

/** Validates the raw dataset up-front so malformed mock data fails loudly with a precise location. */
export function parseInventory(data: unknown): GearItem[] {
  const result = InventorySchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 10)
      .map((issue) => `  - [${issue.path.join(".")}] ${issue.message}`)
      .join("\n");
    throw new InventoryValidationError(`Inventory data is invalid:\n${issues}`, {
      issueCount: result.error.issues.length,
    });
  }

  const ids = new Set<string>();
  for (const item of result.data) {
    if (ids.has(item.id)) throw new InventoryValidationError(`Duplicate inventory id "${item.id}"`);
    ids.add(item.id);
  }
  return result.data;
}

export function createInventoryService(items: GearItem[]): InventoryService {
  const byId = new Map(items.map((item) => [item.id, item]));

  return {
    getAll: () => items,
    getById: (id) => byId.get(id),
    getByIdOrThrow(id) {
      const item = byId.get(id);
      if (!item) throw new NotFoundError("Gear item", id);
      return item;
    },
    getByCategory: (category) => items.filter((item) => item.category === category),
    countByCategory() {
      const counts = { "fotografia-video": 0, "montana-camping": 0, "deportes-acuaticos": 0 };
      for (const item of items) counts[item.category] += 1;
      return counts;
    },
    getRandom(count, rng = Math.random) {
      // Partial Fisher-Yates: unbiased and O(count).
      const pool = [...items];
      const size = Math.min(count, pool.length);
      for (let i = 0; i < size; i++) {
        const j = i + Math.floor(rng() * (pool.length - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, size);
    },
    getAvailability(id, now = new Date()) {
      const item = byId.get(id);
      if (!item) throw new NotFoundError("Gear item", id);
      return resolveBookedRanges(item.bookedOffsets, now);
    },
  };
}

export const inventoryService = createInventoryService(parseInventory(rawInventory));
