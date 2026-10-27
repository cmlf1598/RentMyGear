import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../../app/api/rentals/route";
import { RentalConfirmationSchema } from "../../lib/validation";
import { rentalService } from "../../services/rentalService";

vi.mock("../../services/rentalService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/rentalService")>();
  return { ...actual, rentalService: actual.createRentalService({ latencyMs: 0 }) };
});

const TODAY = new Date(2026, 5, 3, 10, 0);

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/rentals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/rentals — Smart Insurance", () => {
  it("adds 20% insurance for photography equipment and returns a valid confirmation", async () => {
    const response = await post({ itemId: "sony-a7-iv", from: "2026-07-10", to: "2026-07-12" });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(() => RentalConfirmationSchema.parse(body)).not.toThrow();
    // 65 × 3 = 195 · insurance 20% = 39 · fee 8% = 15.60
    expect(body).toMatchObject({ itemId: "sony-a7-iv", days: 3, insurance: 39, total: 249.6, from: "2026-07-10" });
    expect(body.confirmationCode).toMatch(/^RMG-[A-Z0-9]+$/);
  });

  it("adds 10% insurance for other categories", async () => {
    const response = await post({ itemId: "starboard-touring-126", from: "2026-06-10", to: "2026-06-12" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ days: 3, insurance: 13.5, total: 159.3 });
  });

  it("recalculates the price on the server and ignores amounts sent by the client", async () => {
    const response = await post({
      itemId: "starboard-touring-126",
      from: "2026-06-10",
      to: "2026-06-12",
      total: 1,
      insurance: 0,
    });

    expect(await response.json()).toMatchObject({ insurance: 13.5, total: 159.3 });
  });
});

describe("POST /api/rentals — errors", () => {
  it("returns 400 for a body that isn't JSON", async () => {
    const response = await post("not json");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "El cuerpo de la solicitud no es JSON válido" });
  });

  it("returns 404 for an unknown item", async () => {
    const response = await post({ itemId: "nope", from: "2026-06-10", to: "2026-06-12" });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "El equipo no existe" });
  });

  it("returns 422 with field errors for invalid dates", async () => {
    const response = await post({ itemId: "sony-a7-iv", from: "2026-06-01", to: "2026-06-02" });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "Solicitud inválida",
      fieldErrors: {
        from: "La fecha de inicio no puede estar en el pasado",
        to: "La fecha de devolución no puede estar en el pasado",
      },
    });
  });

  it("returns 500 with debug details outside production for unexpected errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(rentalService, "createRental").mockRejectedValueOnce(new Error("boom"));

    const response = await post({ itemId: "sony-a7-iv", from: "2026-07-10", to: "2026-07-12" });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ error: "No pudimos procesar la renta", debug: { message: "boom" } });
  });
});

describe("POST /api/rentals — malformed bodies", () => {
  it.each([null, [], "\"text\""])("treats %j as an unknown item (404)", async (body) => {
    const response = await post(typeof body === "string" ? body : JSON.stringify(body));
    expect(response.status).toBe(404);
  });
});
