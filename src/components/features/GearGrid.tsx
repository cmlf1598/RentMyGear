import { Star } from "lucide-react";
import Link from "next/link";

import { GearCardSkeleton } from "@/components/features/GearCardSkeleton";
import { GearImage } from "@/components/features/GearImage/GearImage";
import { GearGridSearch, type GearGridEntry } from "@/components/features/GearGridSearch";
import { formatCurrency } from "@/lib/date-utils";
import type { GearItem } from "@/types/gear";

/** Images above the fold are preloaded; the rest lazy-load as the user scrolls. */
const PRELOAD_COUNT = 3;

interface GearGridProps {
  items: GearItem[];
  searchPlaceholder?: string;
}

/**
 * Server-rendered grid. Each card's image sits in its own Suspense boundary
 * (inside GearImage), so AI generations stream in independently and never
 * block the rest of the grid.
 */
export function GearGrid({ items, searchPlaceholder }: GearGridProps) {
  const entries: GearGridEntry[] = items.map((item, index) => ({
    id: item.id,
    searchText: [item.name, item.brand, item.tagline, ...Object.values(item.specs)].join(" "),
    card: <GearCard item={item} preload={index < PRELOAD_COUNT} />,
  }));

  return <GearGridSearch entries={entries} placeholder={searchPlaceholder} />;
}

function GearCard({ item, preload }: { item: GearItem; preload: boolean }) {
  return (
    <Link
      href={`/gear/${item.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/5 focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none"
    >
      <GearImage
        item={item}
        sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"
        className="aspect-[4/3]"
        imageClassName="group-hover:scale-[1.03]"
        preload={preload}
      />
      <div className="flex flex-1 flex-col gap-1 p-5">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{item.brand}</span>
          <span className="inline-flex items-center gap-1">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            {item.rating.toFixed(1)} <span className="text-muted-foreground/70">({item.reviewCount})</span>
          </span>
        </div>
        <h3 className="text-[17px] leading-snug font-semibold">{item.name}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.tagline}</p>
        <p className="mt-auto pt-3 text-sm">
          <span className="text-base font-semibold">{formatCurrency(item.dailyRate)}</span>
          <span className="text-muted-foreground"> / día · {item.location}</span>
        </p>
      </div>
    </Link>
  );
}

export function GearGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-6">
      <div className="shimmer h-12 w-full max-w-md rounded-full" />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }, (_, index) => (
          <GearCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
