"use client";

import Autoplay from "embla-carousel-autoplay";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

export interface HeroSlide {
  id: string;
  href: string;
  name: string;
  tagline: string;
  categoryName: string;
  priceLabel: string;
  image: ReactNode;
}

export function HeroCarouselClient({ slides }: { slides: HeroSlide[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const [autoplay] = useState(() => Autoplay({ delay: 6000, stopOnInteraction: false, stopOnMouseEnter: true }));

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  return (
    <Carousel
      setApi={setApi}
      opts={{ loop: true }}
      plugins={[autoplay]}
      className="group/hero relative"
      aria-label="Equipos destacados"
    >
      <CarouselContent className="-ml-0">
        {slides.map((slide, index) => (
          <CarouselItem key={slide.id} className="pl-0" aria-label={`${index + 1} de ${slides.length}`}>
            <div className="group/slide relative isolate aspect-[4/5] overflow-hidden rounded-[2rem] bg-secondary sm:aspect-[16/9] lg:aspect-[21/9]">
              {slide.image}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-6 text-white sm:p-10 lg:p-14">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-md">
                  {slide.categoryName}
                </span>
                <h2 className="max-w-2xl text-3xl font-semibold sm:text-5xl lg:text-6xl">{slide.name}</h2>
                <p className="max-w-xl text-base text-white/80 sm:text-lg">{slide.tagline}</p>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <Button asChild size="lg" className="rounded-full bg-white text-black hover:bg-white/90">
                    <Link href={slide.href}>
                      Ver equipo <ArrowRight />
                    </Link>
                  </Button>
                  <span className="text-sm font-medium text-white/90">Desde {slide.priceLabel}</span>
                </div>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious className="left-4 hidden border-0 bg-white/70 opacity-0 backdrop-blur-md transition-opacity group-hover/hero:opacity-100 sm:flex" />
      <CarouselNext className="right-4 hidden border-0 bg-white/70 opacity-0 backdrop-blur-md transition-opacity group-hover/hero:opacity-100 sm:flex" />

      <div className="absolute right-6 bottom-6 flex gap-1.5 sm:right-10 sm:bottom-10" role="tablist">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            role="tab"
            aria-selected={selected === index}
            aria-label={`Ir a ${slide.name}`}
            onClick={() => api?.scrollTo(index)}
            className={cn(
              "h-1.5 rounded-full bg-white/50 transition-all duration-300",
              selected === index ? "w-6 bg-white" : "w-1.5 hover:bg-white/80",
            )}
          />
        ))}
      </div>
    </Carousel>
  );
}
