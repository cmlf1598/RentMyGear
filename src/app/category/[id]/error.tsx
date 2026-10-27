"use client";

import { ErrorState } from "../../../components/shared/ErrorState";

export default function CategoryError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState
      error={error}
      retry={retry}
      boundary="category"
      title="No pudimos cargar el inventario"
      description="Hubo un problema al obtener los equipos de esta categoría."
    />
  );
}
