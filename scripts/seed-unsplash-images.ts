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

config({ path: [".env.local", ".env"], quiet: true });

/** Exactly 8 items intentionally have no initial image (3 / 3 / 2 per category). */
export const AI_ONLY_IDS = new Set([
  "blackmagic-pocket-6k-pro",
  "dji-ronin-4d",
  "aputure-ls-600d-pro",
  "msr-whisperlite-universal",
  "black-diamond-sprinter-500",
  "garmin-inreach-mini-2",
  "fanatic-sky-wing-foil",
  "seabob-f5-sr",
]);

const INVENTORY_PATH = path.resolve(process.cwd(), "src/data/inventory.json");
const API_URL = "https://api.unsplash.com/search/photos";
const UTM = "utm_source=rent_my_gear&utm_medium=referral";
const MAX_ATTEMPTS = 3;

interface InventoryItem {
  id: string;
  name: string;
  imageURL: string | null;
  imageCredit: { name: string; profileUrl: string; photoUrl: string } | null;
  [key: string]: unknown;
}

interface UnsplashPhoto {
  urls: { raw: string; regular: string };
  links: { html: string };
  user: { name: string; links: { html: string } };
  alt_description: string | null;
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchFirstPhoto(query: string, accessKey: string): Promise<UnsplashPhoto | null> {
  const url = `${API_URL}?${new URLSearchParams({ query, per_page: "1", page: "1" })}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
    });

    if (response.ok) {
      const data = (await response.json()) as { results: UnsplashPhoto[] };
      return data.results[0] ?? null;
    }

    const remaining = response.headers.get("x-ratelimit-remaining");
    if (response.status === 401) throw new Error("Unsplash rejected the access key (401). Check UNSPLASH_ACCESS_KEY.");
    if (response.status === 403 && remaining === "0") {
      throw new Error("Unsplash rate limit reached (50 req/h on demo apps). Re-run later; progress is saved.");
    }
    if (attempt === MAX_ATTEMPTS) {
      throw new Error(`Unsplash search failed for "${query}": HTTP ${response.status} ${await response.text()}`);
    }
    await sleep(1000 * 2 ** attempt);
  }
  return null;
}

/** Sized, cropped CDN URL derived from the first result (stable and next/image friendly). */
function toImageUrl(photo: UnsplashPhoto): string {
  const url = new URL(photo.urls.raw);
  url.searchParams.set("w", "1600");
  url.searchParams.set("q", "80");
  url.searchParams.set("fit", "crop");
  url.searchParams.set("auto", "format");
  return url.toString();
}

async function main() {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!accessKey) {
    console.error("✖ UNSPLASH_ACCESS_KEY is not set. Add it to .env.local and re-run.");
    process.exit(1);
  }

  const items = JSON.parse(await readFile(INVENTORY_PATH, "utf8")) as InventoryItem[];
  const missingAiIds = [...AI_ONLY_IDS].filter((id) => !items.some((item) => item.id === id));
  if (missingAiIds.length > 0) throw new Error(`AI_ONLY_IDS not found in inventory: ${missingAiIds.join(", ")}`);

  let seeded = 0;
  const failures: string[] = [];

  for (const item of items) {
    if (AI_ONLY_IDS.has(item.id)) {
      item.imageURL = null;
      item.imageCredit = null;
      continue;
    }
    if (item.imageURL && !force) continue;

    const photo = await searchFirstPhoto(item.name, accessKey);
    if (!photo) {
      failures.push(item.id);
      console.warn(`  ⚠ ${item.id}: no results for "${item.name}"`);
      continue;
    }

    item.imageURL = toImageUrl(photo);
    item.imageCredit = {
      name: photo.user.name,
      profileUrl: `${photo.user.links.html}?${UTM}`,
      photoUrl: `${photo.links.html}?${UTM}`,
    };
    seeded++;
    console.log(`  ✔ ${item.id} → ${photo.links.html} (${photo.user.name})`);

    if (!dryRun) await writeFile(INVENTORY_PATH, `${JSON.stringify(items, null, 2)}\n`);
  }

  if (!dryRun) await writeFile(INVENTORY_PATH, `${JSON.stringify(items, null, 2)}\n`);

  const withoutImage = items.filter((item) => !item.imageURL).map((item) => item.id);
  console.log(`\nSeeded ${seeded} item(s)${dryRun ? " (dry run, nothing written)" : ""}.`);
  console.log(`Items without imageURL (${withoutImage.length}): ${withoutImage.join(", ")}`);

  if (failures.length > 0) {
    console.error(`✖ ${failures.length} item(s) had no Unsplash result: ${failures.join(", ")}`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(`✖ ${(error as Error).message}`);
  process.exit(1);
});
