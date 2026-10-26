"use client";

import { ErrorState } from "@/components/shared/ErrorState";

export default function HomeError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState
      error={error}
      retry={retry}
      boundary="home"
      title="No pudimos cargar la página principal"
      description="Hubo un problema al preparar los equipos destacados."
    />
  );
}
