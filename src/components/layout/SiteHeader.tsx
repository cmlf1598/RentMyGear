import Link from "next/link";

import { MainNav } from "@/components/layout/MainNav";
import { CATEGORY_LIST } from "@/config/categories";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-foreground text-[11px] font-bold text-background">
            RG
          </span>
          Rent my Gear
        </Link>
        <MainNav categories={CATEGORY_LIST.map(({ id, name }) => ({ id, name }))} />
      </div>
    </header>
  );
}
