import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { CATEGORY_LIST } from "../../config/categories";
import { formatCurrency } from "../../lib/date-utils";
import { getInsuranceRate } from "../../lib/insurance";
import { inventoryService } from "../../services/inventoryService";

const ITEMS_PER_CATEGORY = 3;

/**
 * Per-category price list with the Smart Insurance rate. Deterministic (top-rated items),
 * so it stays in the prerendered shell.
 */
export function CategoryRates() {
  return (
    <section className="pt-20" aria-labelledby="tarifas">
      <div className="mb-8">
        <h2 id="tarifas" className="text-3xl font-semibold sm:text-4xl">
          Tarifas y seguro por categoría
        </h2>
        <p className="mt-2 text-muted-foreground">
          Cada renta incluye Seguro inteligente, calculado sobre la tarifa diaria según el tipo de equipo.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {CATEGORY_LIST.map((category) => {
          const items = inventoryService.getByCategory(category.id);
          const topRated = [...items].sort((a, b) => b.rating - a.rating).slice(0, ITEMS_PER_CATEGORY);
          const lowestRate = Math.min(...items.map((item) => item.dailyRate));
          const headingId = `tarifas-${category.id}`;

          return (
            <article key={category.id} aria-labelledby={headingId} className="rounded-3xl bg-card p-6 ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id={headingId} className="text-lg font-semibold">
                    {category.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">Desde {formatCurrency(lowestRate)} / día</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
                  <ShieldCheck className="size-3.5" />
                  Seguro inteligente {Math.round(getInsuranceRate(category.id) * 100)}%
                </span>
              </div>

              <ul className="mt-4 divide-y divide-border">
                {topRated.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-3 py-3 text-sm">
                    <Link href={`/gear/${item.id}`} className="font-medium hover:underline">
                      {item.name}
                    </Link>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {formatCurrency(item.dailyRate)} / día
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
