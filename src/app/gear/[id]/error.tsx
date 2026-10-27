"use client";

import { ErrorState } from "../../../components/shared/ErrorState";

export default function GearError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState
      error={error}
      retry={retry}
      boundary="gear"
      title="No pudimos cargar este equipo"
      description="Hubo un problema al obtener los detalles o la disponibilidad."
    />
  );
}
