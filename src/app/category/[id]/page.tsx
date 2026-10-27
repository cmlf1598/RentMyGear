import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { GearGrid, GearGridSkeleton } from "../../../components/features/GearGrid";
import { CATEGORY_LIST, getCategory } from "../../../config/categories";
import { cn } from "../../../lib/utils";
import { inventoryService } from "../../../services/inventoryService";

export function generateStaticParams() {
  return CATEGORY_LIST.map((category) => ({ id: category.id }));
}

export async function generateMetadata({ params }: PageProps<"/category/[id]">): Promise<Metadata> {
  const category = getCategory((await params).id);
  return category ? { title: category.name, description: category.description } : {};
}

export default async function CategoryPage({ params }: PageProps<"/category/[id]">) {
  const { id } = await params;
  const category = getCategory(id);
  if (!category) notFound();

  const items = inventoryService.getByCategory(category.id);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <header className="pt-12 pb-10 sm:pt-16">
        <nav className="flex flex-wrap gap-2" aria-label="Categorías">
          {CATEGORY_LIST.map((other) => (
            <Link
              key={other.id}
              href={`/category/${other.id}`}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition-colors",
                other.id === category.id
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {other.name}
            </Link>
          ))}
        </nav>
        <h1 className="mt-8 text-4xl font-semibold sm:text-5xl">{category.name}</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{category.description}</p>
      </header>

      {/* GearGridSearch reads search params, so it needs its own Suspense boundary under PPR. */}
      <Suspense fallback={<GearGridSkeleton />}>
        <GearGrid items={items} searchPlaceholder={`Buscar en ${category.name}…`} />
      </Suspense>
    </div>
  );
}
