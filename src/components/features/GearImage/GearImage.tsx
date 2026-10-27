import { ImageOff, Sparkles } from "lucide-react";
import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";

import { ImageErrorBoundary } from "./ImageErrorBoundary";
import { ImageGenerationError } from "../../../lib/errors";
import { describeImageFailure, type ImageFailureInfo } from "../../../lib/image-failure";
import { cn } from "../../../lib/utils";
import { getImageService } from "../../../services/imageService";
import type { GearItem } from "../../../types/gear";

interface GearImageProps {
  item: GearItem;
  sizes: string;
  /** Wrapper classes — must define the box (e.g. aspect ratio) since the image fills it. */
  className?: string;
  imageClassName?: string;
  preload?: boolean;
  showAiBadge?: boolean;
  /** Positions the generating/failed placeholders (e.g. keep them clear of overlaid text). */
  statusClassName?: string;
}

/**
 * Image strategy entry point. Items with an `imageURL` render immediately (and
 * stay in the static shell); items without one stream in once Nano Banana has
 * generated the image and it has been persisted to GCS.
 */
export function GearImage({ item, className, statusClassName, ...props }: GearImageProps) {
  const frame = cn("relative overflow-hidden bg-secondary", className);

  if (item.imageURL) {
    return (
      <div className={frame}>
        <ImageFill src={item.imageURL} alt={item.name} {...props} />
      </div>
    );
  }

  return (
    <div className={frame}>
      <ImageErrorBoundary itemName={item.name} className={cn("absolute inset-0", statusClassName)}>
        <Suspense fallback={<GeneratingPlaceholder className={statusClassName} />}>
          <ResolvedGearImage item={item} statusClassName={statusClassName} {...props} />
        </Suspense>
      </ImageErrorBoundary>
    </div>
  );
}

async function ResolvedGearImage({ item, statusClassName, ...props }: Omit<GearImageProps, "className">) {
  // Generation/GCS lookups are request-time work; keep them out of the prerender.
  await connection();
  // Expected failures (quota, credits, safety filters) render here on the server so the
  // details survive production, where error-boundary messages are redacted.
  const result = await getImageService()
    .resolveImageUrl(item)
    .then(
      (image) => ({ image }),
      (error: unknown) => {
        if (!(error instanceof ImageGenerationError)) throw error;
        return { failure: describeImageFailure(error) };
      },
    );

  if ("failure" in result) return <ImageUnavailable failure={result.failure} className={statusClassName} />;
  const { image } = result;
  return <ImageFill src={image.url} alt={item.name} aiGenerated={image.isAiGenerated} {...props} />;
}

function ImageFill({
  src,
  alt,
  sizes,
  imageClassName,
  preload,
  aiGenerated = false,
  showAiBadge = true,
}: Omit<GearImageProps, "item" | "className" | "statusClassName"> & {
  src: string;
  alt: string;
  aiGenerated?: boolean;
}) {
  return (
    <>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        preload={preload}
        className={cn("object-cover transition-transform duration-700 ease-out", imageClassName)}
      />
      {aiGenerated && showAiBadge && (
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-md">
          <Sparkles className="size-3 text-brand" /> Generada con IA
        </span>
      )}
    </>
  );
}

function ImageUnavailable({ failure, className }: { failure: ImageFailureInfo; className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-secondary px-4 text-center text-muted-foreground",
        className,
      )}
      role="status"
      title={failure.providerMessage}
    >
      <ImageOff className="mb-0.5 size-6" />
      <p className="text-xs font-medium text-foreground">Imagen no disponible</p>
      <p className="max-w-64 text-xs text-balance">
        {failure.reason} Intenta de nuevo {failure.retryIn ?? "más tarde"}.
      </p>
      <code className="mt-0.5 rounded-full bg-background/70 px-2 py-0.5 font-mono text-[10px]">{failure.technical}</code>
    </div>
  );
}

function GeneratingPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn("shimmer absolute inset-0 flex flex-col items-center justify-center gap-2", className)}
      role="status"
    >
      <Sparkles className="size-5 animate-pulse text-brand" />
      <p className="text-xs font-medium text-muted-foreground">Generando imagen con IA…</p>
    </div>
  );
}
