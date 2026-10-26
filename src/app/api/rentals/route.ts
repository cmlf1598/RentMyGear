import { NextResponse } from "next/server";

import { NotFoundError, RentalValidationError, serializeError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { rentalService } from "@/services/rentalService";

/** Mock booking endpoint used by the RentalFlow confirmation step. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud no es JSON válido" }, { status: 400 });
  }

  try {
    const confirmation = await rentalService.createRental(body);
    return NextResponse.json(confirmation, { status: 201 });
  } catch (error) {
    if (error instanceof RentalValidationError) {
      return NextResponse.json({ error: "Solicitud inválida", fieldErrors: error.details?.fieldErrors }, { status: 422 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "El equipo no existe" }, { status: 404 });
    }
    logger.child("api:rentals").error("Unexpected rental error", { error });
    return NextResponse.json(
      {
        error: "No pudimos procesar la renta",
        ...(process.env.NODE_ENV !== "production" && { debug: serializeError(error) }),
      },
      { status: 500 },
    );
  }
}
