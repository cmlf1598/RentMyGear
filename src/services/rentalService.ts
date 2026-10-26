import "server-only";

import { calculateRentalPrice } from "@/lib/date-utils";
import { RentalValidationError } from "@/lib/errors";
import { logger as rootLogger, type Logger } from "@/lib/logger";
import {
  createRentalRequestSchema,
  toDateOnly,
  toFieldErrors,
  type RentalConfirmation,
} from "@/lib/validation";
import { inventoryService as defaultInventory, type InventoryService } from "@/services/inventoryService";

export interface RentalServiceDeps {
  inventory?: InventoryService;
  now?: () => Date;
  latencyMs?: number;
  logger?: Logger;
}

export interface RentalService {
  /** Mock booking: validates server-side, recomputes the price and returns a confirmation. */
  createRental(input: unknown): Promise<RentalConfirmation>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function confirmationCode(now: Date): string {
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `RMG-${now.getTime().toString(36).slice(-4).toUpperCase()}${random}`;
}

export function createRentalService({
  inventory = defaultInventory,
  now = () => new Date(),
  latencyMs = 900,
  logger = rootLogger.child("rentalService"),
}: RentalServiceDeps = {}): RentalService {
  return {
    async createRental(input) {
      const itemId =
        typeof input === "object" && input !== null && "itemId" in input ? String(input.itemId) : "";
      const item = inventory.getByIdOrThrow(itemId);

      const schema = createRentalRequestSchema({ now, bookedRanges: inventory.getAvailability(item.id, now()) });
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        throw new RentalValidationError("Rental request is invalid", { fieldErrors: toFieldErrors(parsed.error) });
      }

      await sleep(latencyMs);

      const { from, to } = parsed.data;
      const price = calculateRentalPrice(item.dailyRate, from, to, item.deposit);
      const createdAt = now();
      const confirmation: RentalConfirmation = {
        confirmationCode: confirmationCode(createdAt),
        itemId: item.id,
        from: toDateOnly(from),
        to: toDateOnly(to),
        days: price.days,
        total: price.total,
        deposit: price.deposit,
        createdAt: createdAt.toISOString(),
      };

      logger.info("Mock rental confirmed", { ...confirmation });
      return confirmation;
    },
  };
}

export const rentalService = createRentalService();
