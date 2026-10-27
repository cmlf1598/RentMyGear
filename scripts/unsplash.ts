/**
 * Unsplash lookup used by `seed-unsplash-images.ts`. Kept separate from the CLI
 * so the request/fallback rules can be tested without touching the network.
 */

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

const API_URL = "https://api.unsplash.com/search/photos";
const UTM = "utm_source=rent_my_gear&utm_medium=referral";
const MAX_ATTEMPTS = 3;

export interface InventoryItem {
  id: string;
  name: string;
  imageURL: string | null;
  imageCredit: { name: string; profileUrl: string; photoUrl: string } | null;
  [key: string]: unknown;
}

export interface UnsplashPhoto {
  urls: { raw: string; regular: string };
  links: { html: string };
  user: { name: string; links: { html: string } };
  alt_description: string | null;
}

export interface SearchOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * First search result for `query`, or null when Unsplash has nothing for it.
 * A 404 counts as "nothing": the item keeps `imageURL: null` and Nano Banana
 * generates its image at runtime.
 */
export async function searchFirstPhoto(
  query: string,
  accessKey: string,
  { fetch: fetchImpl = fetch, sleep = defaultSleep }: SearchOptions = {},
): Promise<UnsplashPhoto | null> {
  const url = `${API_URL}?${new URLSearchParams({ query, per_page: "1", page: "1" })}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetchImpl(url, {
      headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
    });

    if (response.ok) {
      const data = (await response.json()) as { results: UnsplashPhoto[] };
      return data.results[0] ?? null;
    }

    if (response.status === 404) return null;
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
export function toImageUrl(photo: UnsplashPhoto): string {
  const url = new URL(photo.urls.raw);
  url.searchParams.set("w", "1600");
  url.searchParams.set("q", "80");
  url.searchParams.set("fit", "crop");
  url.searchParams.set("auto", "format");
  return url.toString();
}

export interface SeedOptions {
  search: (query: string) => Promise<UnsplashPhoto | null>;
  force?: boolean;
  aiOnlyIds?: Set<string>;
  /** Called after each item is seeded, e.g. to save progress. */
  onSeeded?: (item: InventoryItem, photo: UnsplashPhoto) => Promise<void> | void;
}

export interface SeedResult {
  seeded: number;
  /** Items with no Unsplash photo; they keep `imageURL: null` and fall back to Nano Banana. */
  failures: string[];
}

/** Fills `imageURL` + credit in place for every eligible item. */
export async function seedInventoryImages(
  items: InventoryItem[],
  { search, force = false, aiOnlyIds = AI_ONLY_IDS, onSeeded }: SeedOptions,
): Promise<SeedResult> {
  let seeded = 0;
  const failures: string[] = [];

  for (const item of items) {
    if (aiOnlyIds.has(item.id)) {
      item.imageURL = null;
      item.imageCredit = null;
      continue;
    }
    if (item.imageURL && !force) continue;

    const photo = await search(item.name);
    if (!photo) {
      failures.push(item.id);
      continue;
    }

    item.imageURL = toImageUrl(photo);
    item.imageCredit = {
      name: photo.user.name,
      profileUrl: `${photo.user.links.html}?${UTM}`,
      photoUrl: `${photo.links.html}?${UTM}`,
    };
    seeded++;
    await onSeeded?.(item, photo);
  }

  return { seeded, failures };
}
