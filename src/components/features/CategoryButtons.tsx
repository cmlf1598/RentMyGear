import { ArrowUpRight, Camera, Mountain, Waves, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { CATEGORY_LIST } from "../../config/categories";
import { cn } from "../../lib/utils";
import { inventoryService } from "../../services/inventoryService";
import type { CategoryId } from "../../types/gear";

const STYLES: Record<CategoryId, { icon: LucideIcon; tile: string; iconWrap: string }> = {
  "fotografia-video": {
    icon: Camera,
    tile: "from-amber-50 via-orange-50 to-rose-100 hover:shadow-orange-200/60",
    iconWrap: "bg-orange-500/10 text-orange-600",
  },
  "montana-camping": {
    icon: Mountain,
    tile: "from-emerald-50 via-teal-50 to-lime-100 hover:shadow-emerald-200/60",
    iconWrap: "bg-emerald-600/10 text-emerald-700",
  },
  "deportes-acuaticos": {
    icon: Waves,
    tile: "from-sky-50 via-cyan-50 to-blue-100 hover:shadow-sky-200/60",
    iconWrap: "bg-sky-500/10 text-sky-600",
  },
};

export function CategoryButtons() {
  const counts = inventoryService.countByCategory();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {CATEGORY_LIST.map((category) => {
        const { icon: Icon, tile, iconWrap } = STYLES[category.id];
        return (
          <Link
            key={category.id}
            href={`/category/${category.id}`}
            className={cn(
              "group relative flex min-h-56 flex-col justify-between overflow-hidden rounded-[2rem] bg-gradient-to-br p-8 ring-1 ring-black/5 transition-all duration-300",
              "hover:-translate-y-1 hover:shadow-2xl focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none md:min-h-72",
              tile,
            )}
          >
            <div className="flex items-start justify-between">
              <span className={cn("grid size-14 place-items-center rounded-2xl", iconWrap)}>
                <Icon className="size-7" strokeWidth={1.75} />
              </span>
              <span className="grid size-10 place-items-center rounded-full bg-white/70 text-foreground shadow-sm transition-transform duration-300 group-hover:rotate-45">
                <ArrowUpRight className="size-5" />
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{counts[category.id]} equipos disponibles</p>
              <h3 className="mt-1 text-2xl font-semibold md:text-3xl">{category.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{category.tagline}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
