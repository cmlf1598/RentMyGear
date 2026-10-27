"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "../ui/button";

interface ErrorStateProps {
  error: unknown;
  retry?: () => void;
  title?: string;
  description?: string;
  /** Identifies which boundary caught the error in the browser console. */
  boundary: string;
}

/** Shared fallback UI for route-level error boundaries. */
export function ErrorState({
  error,
  retry,
  title = "Algo salió mal",
  description = "Ocurrió un problema al cargar esta sección. Puedes intentarlo de nuevo.",
  boundary,
}: ErrorStateProps) {
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : undefined;
  const message = error instanceof Error ? error.message : String(error);

  useEffect(() => {
    console.error(`[ErrorBoundary:${boundary}]`, { digest, error });
  }, [boundary, digest, error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-muted-foreground">{description}</p>
      {process.env.NODE_ENV !== "production" && (
        <pre className="mt-6 max-w-full overflow-x-auto rounded-xl bg-secondary px-4 py-3 text-left font-mono text-xs text-muted-foreground">
          {message}
        </pre>
      )}
      {digest && <p className="mt-3 font-mono text-xs text-muted-foreground">Referencia: {digest}</p>}
      <div className="mt-8 flex gap-3">
        {retry && (
          <Button onClick={() => retry()} className="rounded-full">
            <RotateCcw /> Intentar de nuevo
          </Button>
        )}
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
