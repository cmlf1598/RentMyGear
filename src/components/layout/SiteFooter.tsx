import Link from "next/link";

import { CATEGORY_LIST } from "../../config/categories";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-secondary/50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 text-sm text-muted-foreground sm:grid-cols-3 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <p className="font-semibold text-foreground">Rent my Gear</p>
          <p className="max-w-xs">Equipo premium, sin compromisos. Renta por días y vive la experiencia completa.</p>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-foreground">Categorías</p>
          <ul className="space-y-1.5">
            {CATEGORY_LIST.map((category) => (
              <li key={category.id}>
                <Link href={`/category/${category.id}`} className="transition-colors hover:text-foreground">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-foreground">Transparencia</p>
          <p>Las imágenes marcadas como «Generada con IA» fueron creadas con Nano Banana Pro.</p>
          <p>Fotografías de catálogo cortesía de Unsplash.</p>
        </div>
      </div>
    </footer>
  );
}
