/**
 * Seeds `imageURL` for the mock inventory using the official Unsplash API:
 * for each item, search by its name and take the first result.
 *
 * Items listed in AI_ONLY_IDS are deliberately left without an image so the
 * Nano Banana → GCS fallback is exercised.
 *
 * Usage:
 *   npm run seed:images              # seed items that have no imageURL yet
 *   npm run seed:images -- --force   # re-seed every non-AI item
 *   npm run seed:images -- --dry-run # print results without writing
 *
 * Requires UNSPLASH_ACCESS_KEY in .env.local (https://unsplash.com/oauth/applications).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { config } from "dotenv";

import { AI_ONLY_IDS, type InventoryItem, searchFirstPhoto, seedInventoryImages } from "./unsplash";

config({ path: [".env.local", ".env"], quiet: true });

const INVENTORY_PATH = path.resolve(process.cwd(), "src/data/inventory.json");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");

async function main() {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!accessKey) {
    console.error("✖ UNSPLASH_ACCESS_KEY is not set. Add it to .env.local and re-run.");
    process.exit(1);
  }

  const items = JSON.parse(await readFile(INVENTORY_PATH, "utf8")) as InventoryItem[];
  const missingAiIds = [...AI_ONLY_IDS].filter((id) => !items.some((item) => item.id === id));
  if (missingAiIds.length > 0) throw new Error(`AI_ONLY_IDS not found in inventory: ${missingAiIds.join(", ")}`);

  const save = () => writeFile(INVENTORY_PATH, `${JSON.stringify(items, null, 2)}\n`);

  const { seeded, failures } = await seedInventoryImages(items, {
    search: (query) => searchFirstPhoto(query, accessKey),
    force,
    async onSeeded(item, photo) {
      console.log(`  ✔ ${item.id} → ${photo.links.html} (${photo.user.name})`);
      if (!dryRun) await save();
    },
  });

  if (!dryRun) await save();

  for (const id of failures) console.warn(`  ⚠ ${id}: no Unsplash results`);
  const withoutImage = items.filter((item) => !item.imageURL).map((item) => item.id);
  console.log(`\nSeeded ${seeded} item(s)${dryRun ? " (dry run, nothing written)" : ""}.`);
  console.log(`Items without imageURL (${withoutImage.length}): ${withoutImage.join(", ")}`);

  if (failures.length > 0) {
    console.error(
      `✖ ${failures.length} item(s) had no Unsplash result (Nano Banana will generate them): ${failures.join(", ")}`,
    );
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(`✖ ${(error as Error).message}`);
  process.exit(1);
});
