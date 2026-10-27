import { GearGridSkeleton } from "../../../components/features/GearGrid";

export default function CategoryLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-busy>
      <div className="space-y-4 pt-12 pb-10 sm:pt-16">
        <div className="flex gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="shimmer h-8 w-36 rounded-full" />
          ))}
        </div>
        <div className="shimmer mt-8 h-12 w-80 rounded-full" />
        <div className="shimmer h-5 w-full max-w-xl rounded-full" />
      </div>
      <GearGridSkeleton />
    </div>
  );
}
