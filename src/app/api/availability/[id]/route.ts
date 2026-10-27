import { connection, NextResponse } from "next/server";

import { toISORanges } from "../../../../lib/date-utils";
import { inventoryService } from "../../../../services/inventoryService";

export async function GET(_request: Request, { params }: RouteContext<"/api/availability/[id]">) {
  await connection();
  const { id } = await params;
  if (!inventoryService.getById(id)) {
    return NextResponse.json({ error: `Item "${id}" not found` }, { status: 404 });
  }

  return NextResponse.json(
    { itemId: id, bookedRanges: toISORanges(inventoryService.getAvailability(id)), checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
