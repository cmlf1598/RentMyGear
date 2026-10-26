export default function GearLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8" aria-busy>
      <div className="shimmer h-4 w-32 rounded-full" />
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-14">
        <div className="space-y-6">
          <div className="shimmer aspect-[4/3] rounded-[2rem]" />
          <div className="shimmer h-4 w-24 rounded-full" />
          <div className="shimmer h-12 w-3/4 rounded-full" />
          <div className="shimmer h-20 w-full rounded-2xl" />
        </div>
        <div className="shimmer h-[560px] rounded-[2rem]" />
      </div>
    </div>
  );
}
