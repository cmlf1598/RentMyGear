import { HeroCarouselSkeleton } from "@/components/features/HeroCarousel";

export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-busy>
      <div className="flex flex-col items-center gap-4 pt-12 pb-8 sm:pt-20 sm:pb-12">
        <div className="shimmer h-4 w-40 rounded-full" />
        <div className="shimmer h-12 w-full max-w-2xl rounded-full" />
        <div className="shimmer h-5 w-full max-w-md rounded-full" />
      </div>
      <HeroCarouselSkeleton />
      <div className="grid gap-4 pt-20 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="shimmer min-h-56 rounded-[2rem] md:min-h-72" />
        ))}
      </div>
    </div>
  );
}
