"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * Last-resort boundary: replaces the root layout when it (or anything not
 * covered by a nested error.tsx) throws, so it must render its own <html>.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : undefined;

  useEffect(() => {
    console.error("[ErrorBoundary:global]", { digest, error });
  }, [digest, error]);

  return (
    <html lang="es">
      <body className="grid min-h-screen place-items-center bg-background px-4 font-sans text-foreground antialiased">
        <div className="max-w-md text-center">
          <p className="text-sm font-medium text-muted-foreground">Rent my Gear</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Tuvimos un problema inesperado</h1>
          <p className="mt-3 text-muted-foreground">
            Nuestro equipo ya fue notificado. Intenta recargar la página en unos momentos.
          </p>
          {digest && <p className="mt-4 font-mono text-xs text-muted-foreground">Referencia: {digest}</p>}
          <button
            onClick={() => retry()}
            className="mt-8 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
