"use client";

import { Search, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";

import { Input } from "../ui/input";

export interface GearGridEntry {
  id: string;
  searchText: string;
  card: ReactNode;
}

/** Lowercases and strips diacritics so "fotografia" matches "Fotografía". */
export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function matchesQuery(searchText: string, query: string): boolean {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalizeSearch(searchText);
  return terms.every((term) => haystack.includes(term));
}

export function GearGridSearch({ entries, placeholder = "Buscar por nombre, marca o especificación…" }: {
  entries: GearGridEntry[];
  placeholder?: string;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const deferredQuery = useDeferredValue(query);

  const visibleIds = useMemo(
    () => new Set(entries.filter((entry) => matchesQuery(entry.searchText, deferredQuery)).map((e) => e.id)),
    [entries, deferredQuery],
  );

  const updateQuery = (value: string) => {
    setQuery(value);
    // Keep the URL shareable without triggering a server round-trip.
    const params = new URLSearchParams(window.location.search);
    if (value) params.set("q", value);
    else params.delete("q");
    const search = params.toString();
    window.history.replaceState(null, "", search ? `${pathname}?${search}` : pathname);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder={placeholder}
            aria-label="Buscar equipo"
            className="h-12 rounded-full border-0 bg-secondary pr-11 pl-11 text-[15px] shadow-none focus-visible:bg-background [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => updateQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {visibleIds.size} {visibleIds.size === 1 ? "resultado" : "resultados"}
        </p>
      </div>

      {/* Cards stay mounted (just hidden) so already-streamed images aren't re-requested while filtering. */}
      <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => (
          <li key={entry.id} hidden={!visibleIds.has(entry.id)} className="[content-visibility:auto] [contain-intrinsic-size:auto_420px]">
            {entry.card}
          </li>
        ))}
      </ul>

      {visibleIds.size === 0 && (
        <div className="rounded-3xl bg-secondary/60 px-6 py-16 text-center">
          <p className="text-lg font-medium">Sin resultados para «{query}»</p>
          <p className="mt-1 text-sm text-muted-foreground">Prueba con otra marca, modelo o especificación.</p>
        </div>
      )}
    </div>
  );
}
