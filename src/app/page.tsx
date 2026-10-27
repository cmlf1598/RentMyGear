import { CalendarCheck, PackageCheck, Sparkles } from "lucide-react";
import { Suspense } from "react";

import { CategoryButtons } from "@/components/features/CategoryButtons";
import { HeroCarousel, HeroCarouselSkeleton } from "@/components/features/HeroCarousel";

const HIGHLIGHTS = [
  { icon: Sparkles, title: "Equipo premium", text: "Marcas líderes, revisadas y listas antes de cada renta." },
  { icon: CalendarCheck, title: "Reserva en minutos", text: "Elige tus fechas y conoce el precio final al instante." },
  { icon: PackageCheck, title: "Depósito reembolsable", text: "Sin sorpresas: liberamos el depósito al devolver el equipo." },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="pt-12 pb-8 text-center sm:pt-20 sm:pb-12">
        <p className="text-sm font-medium text-brand">Renta de equipo premium</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold sm:text-6xl">
          El equipo perfecto para tu próxima aventura.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Cámaras de cine, equipo de montaña y deportes acuáticos. Sin comprar, sin compromisos.
        </p>
      </section>

      <section aria-label="Equipos destacados">
        <Suspense fallback={<HeroCarouselSkeleton />}>
          <HeroCarousel />
        </Suspense>
      </section>

      <section className="pt-20" aria-labelledby="categorias">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 id="categorias" className="text-3xl font-semibold sm:text-4xl">
              Explora por categoría
            </h2>
            <p className="mt-2 text-muted-foreground">Encuentra exactamente lo que necesitas.</p>
          </div>
        </div>
        <CategoryButtons />
      </section>

      <section className="grid gap-6 pt-20 sm:grid-cols-3">
        {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-3xl bg-secondary/60 p-6">
            <Icon className="size-5 text-brand" />
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
