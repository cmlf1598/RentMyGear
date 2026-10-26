export function GearCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl bg-card ring-1 ring-black/5" aria-hidden>
      <div className="shimmer aspect-[4/3]" />
      <div className="space-y-3 p-5">
        <div className="shimmer h-3 w-1/3 rounded-full" />
        <div className="shimmer h-5 w-3/4 rounded-full" />
        <div className="shimmer h-3 w-full rounded-full" />
        <div className="shimmer h-4 w-1/2 rounded-full" />
      </div>
    </div>
  );
}
