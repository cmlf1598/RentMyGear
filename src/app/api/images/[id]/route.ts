import { connection, NextResponse } from "next/server";

import { AppError, serializeError } from "../../../../lib/errors";
import { describeImageFailure } from "../../../../lib/image-failure";
import { getImageService } from "../../../../services/imageService";
import { inventoryService } from "../../../../services/inventoryService";

/**
 * Debug endpoint: resolves (and if needed generates) an item's image and
 * reports which source served it. `?fresh=1` clears the in-memory cache first.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/images/[id]">) {
  await connection();
  const { id } = await params;
  const item = inventoryService.getById(id);
  if (!item) return NextResponse.json({ error: `Item "${id}" not found` }, { status: 404 });

  const service = getImageService();
  if (new URL(request.url).searchParams.has("fresh")) service.clearCache();

  const startedAt = performance.now();
  try {
    const image = await service.resolveImageUrl(item);
    return NextResponse.json({
      itemId: id,
      imageURL: image.url,
      source: image.source,
      isAiGenerated: image.isAiGenerated,
      ms: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    return NextResponse.json(
      { itemId: id, failure: describeImageFailure(error), error: serializeError(error) },
      { status: error instanceof AppError && error.code === "STORAGE_FAILED" ? 503 : 502 },
    );
  }
}
