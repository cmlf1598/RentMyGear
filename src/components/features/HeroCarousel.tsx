import { connection } from "next/server";

import { GearImage } from "./GearImage/GearImage";
import { HeroCarouselClient, type HeroSlide } from "./HeroCarouselClient";
import { CATEGORIES } from "../../config/categories";
import { formatCurrency } from "../../lib/date-utils";
import { inventoryService } from "../../services/inventoryService";

export const HERO_ITEM_COUNT = 5;

/**
 * Picks 5 random items per request and renders their slides on the server;
 * the client component only handles autoplay and navigation.
 */
export async function HeroCarousel() {
  // Randomness must be evaluated per request, not baked into the prerendered shell.
  await connection();
  const items = inventoryService.getRandom(HERO_ITEM_COUNT);

  const slides: HeroSlide[] = items.map((item, index) => ({
    id: item.id,
    href: `/gear/${item.id}`,
    name: item.name,
    tagline: item.tagline,
    categoryName: CATEGORIES[item.category].name,
    priceLabel: `${formatCurrency(item.dailyRate)} / día`,
    image: (
      <GearImage
        item={item}
        sizes="(min-width: 1280px) 1216px, 100vw"
        className="absolute inset-0"
        imageClassName="group-hover/slide:scale-[1.02]"
        statusClassName="justify-start pt-10 sm:pt-16"
        preload={index === 0}
      />
    ),
  }));

  return <HeroCarouselClient slides={slides} />;
}

export function HeroCarouselSkeleton() {
  return (
    <div className="shimmer aspect-[4/5] w-full rounded-[2rem] sm:aspect-[16/9] lg:aspect-[21/9]" aria-hidden />
  );
}
