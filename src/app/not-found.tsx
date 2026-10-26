import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-32 text-center">
      <p className="text-sm font-medium text-brand">Error 404</p>
      <h1 className="mt-3 text-4xl font-semibold">No encontramos lo que buscas</h1>
      <p className="mt-3 text-muted-foreground">
        Puede que el equipo ya no esté disponible o que el enlace sea incorrecto.
      </p>
      <Button asChild size="lg" className="mt-8 rounded-full">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
