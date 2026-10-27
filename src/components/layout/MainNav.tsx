"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "../../lib/utils";

interface MainNavProps {
  categories: { id: string; name: string }[];
}

export function MainNav({ categories }: MainNavProps) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Inicio" },
    ...categories.map((category) => ({ href: `/category/${category.id}`, label: category.name })),
  ];

  return (
    <nav aria-label="Principal" className="-mx-2 flex min-w-0 items-center gap-1 overflow-x-auto px-2 [scrollbar-width:none]">
      {links.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground",
              active && "bg-secondary font-medium text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
