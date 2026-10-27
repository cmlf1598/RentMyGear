"use client";

import { ImageOff, RotateCcw } from "lucide-react";
import { catchError, type ErrorInfo } from "next/error";
import { useEffect } from "react";

import { cn } from "../../../lib/utils";

function ImageFallback(props: { itemName: string; className?: string }, { error, retry }: ErrorInfo) {
  useEffect(() => {
    console.error(`[ErrorBoundary:image] ${props.itemName}`, error);
  }, [error, props.itemName]);

  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-2 bg-secondary text-muted-foreground", props.className)}
    >
      <ImageOff className="size-6" />
      <p className="px-4 text-center text-xs">Imagen no disponible</p>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          retry();
        }}
        className="inline-flex items-center gap-1 rounded-full bg-background/80 px-3 py-1 text-[11px] font-medium text-foreground shadow-sm transition hover:bg-background"
      >
        <RotateCcw className="size-3" /> Reintentar
      </button>
    </div>
  );
}

/** Per-image boundary: a failed AI generation never takes down the surrounding grid/page. */
export const ImageErrorBoundary = catchError(ImageFallback);
