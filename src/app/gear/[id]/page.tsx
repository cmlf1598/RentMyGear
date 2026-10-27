import { addDays } from "date-fns";
import { ChevronLeft, MapPin, ShieldCheck, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { GearImage } from "../../../components/features/GearImage/GearImage";
import { RentalFlow } from "../../../components/features/RentalFlow";
import { Badge } from "../../../components/ui/badge";
import { CATEGORIES } from "../../../config/categories";
import { formatCurrency, formatDate, isRangeAvailable, toISORanges } from "../../../lib/date-utils";
import { calculateInsurance, getInsuranceRate } from "../../../lib/insurance";
import { inventoryService } from "../../../services/inventoryService";
import type { GearItem } from "../../../types/gear";

export function generateStaticParams() {
  return inventoryService.getAll().map((item) => ({ id: item.id }));
}

export async function generateMetadata({ params }: PageProps<"/gear/[id]">): Promise<Metadata> {
  const item = inventoryService.getById((await params).id);
  return item ? { title: item.name, description: item.tagline } : {};
}

export default async function GearPage({ params }: PageProps<"/gear/[id]">) {
  const { id } = await params;
  const item = inventoryService.getById(id);
  if (!item) notFound();

  const category = CATEGORIES[item.category];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
      <Link
        href={`/category/${category.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> {category.name}
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-14">
        <div className="space-y-10">
          <GearImage
            item={item}
            sizes="(min-width: 1024px) 760px, 100vw"
            className="aspect-[4/3] rounded-[2rem] ring-1 ring-black/5"
            preload
          />

          <section>
            <p className="text-sm font-medium text-muted-foreground">{item.brand}</p>
            <h1 className="mt-1 text-4xl font-semibold sm:text-5xl">{item.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                <span className="font-medium text-foreground">{item.rating.toFixed(1)}</span> ({item.reviewCount}{" "}
                reseñas)
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" /> {item.location}
              </span>
            </div>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">{item.description}</p>
          </section>

          <section aria-labelledby="specs">
            <h2 id="specs" className="text-2xl font-semibold">
              Especificaciones técnicas
            </h2>
            <dl className="mt-5 divide-y divide-border overflow-hidden rounded-3xl bg-card ring-1 ring-black/5">
              {Object.entries(item.specs).map(([label, value]) => (
                <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 px-6 py-4 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {item.imageCredit && (
            <p className="text-xs text-muted-foreground">
              Foto de{" "}
              <a href={item.imageCredit.profileUrl} className="underline underline-offset-2" target="_blank" rel="noreferrer">
                {item.imageCredit.name}
              </a>{" "}
              en{" "}
              <a href={item.imageCredit.photoUrl} className="underline underline-offset-2" target="_blank" rel="noreferrer">
                Unsplash
              </a>
            </p>
          )}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-[2rem] bg-card p-6 shadow-xl shadow-black/5 ring-1 ring-black/5 sm:p-8">
            <div className="flex items-baseline justify-between gap-4">
              <p>
                <span className="text-3xl font-semibold">{formatCurrency(item.dailyRate)}</span>
                <span className="text-muted-foreground"> / día</span>
              </p>
              <Suspense fallback={<span className="shimmer h-6 w-28 rounded-full" />}>
                <AvailabilityBadge item={item} />
              </Suspense>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Depósito reembolsable de {formatCurrency(item.deposit)}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-brand" />
              Seguro inteligente: {Math.round(getInsuranceRate(item.category) * 100)}% de la tarifa (
              {formatCurrency(calculateInsurance(item.category, item.dailyRate))} / día)
            </p>
            <div className="mt-6">
              <Suspense fallback={<RentalPanelSkeleton />}>
                <RentalPanel item={item} />
              </Suspense>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Availability depends on "today", so it's computed at request time. */
async function AvailabilityBadge({ item }: { item: GearItem }) {
  await connection();
  const now = new Date();
  const booked = inventoryService.getAvailability(item.id, now);
  const availableToday = isRangeAvailable(now, now, booked);
  const currentBooking = booked.find((range) => !isRangeAvailable(now, now, [range]));

  return availableToday ? (
    <Badge className="rounded-full bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">
      <span className="size-1.5 rounded-full bg-emerald-500" /> Disponible hoy
    </Badge>
  ) : (
    <Badge variant="secondary" className="rounded-full">
      Libre desde el {currentBooking ? formatDate(addDays(currentBooking.to, 1), "d 'de' MMM") : "próximamente"}
    </Badge>
  );
}

async function RentalPanel({ item }: { item: GearItem }) {
  await connection();
  const booked = toISORanges(inventoryService.getAvailability(item.id));

  return (
    <RentalFlow
      item={{ id: item.id, name: item.name, dailyRate: item.dailyRate, deposit: item.deposit, category: item.category }}
      initialBookedRanges={booked}
    />
  );
}

function RentalPanelSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="shimmer h-6 w-full rounded-full" />
      <div className="shimmer h-80 w-full rounded-2xl" />
      <div className="shimmer h-12 w-full rounded-full" />
    </div>
  );
}
