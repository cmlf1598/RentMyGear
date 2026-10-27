import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../../app/api/availability/[id]/route";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const TODAY = new Date(2026, 5, 3, 10, 0);

const get = (id: string) =>
  GET(new Request(`http://localhost/api/availability/${id}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/availability/:id", () => {
  it("returns the booked ranges resolved against today, never cached", async () => {
    // red-paddle-ride-108 has bookings starting 4 days (2 long) and 15 days (3 long) from today.
    const response = await get("red-paddle-ride-108");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      itemId: "red-paddle-ride-108",
      bookedRanges: [
        { from: new Date(2026, 5, 7).toISOString(), to: new Date(2026, 5, 8).toISOString() },
        { from: new Date(2026, 5, 18).toISOString(), to: new Date(2026, 5, 20).toISOString() },
      ],
      checkedAt: TODAY.toISOString(),
    });
  });

  it("returns 404 for an unknown item", async () => {
    const response = await get("nope");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Item "nope" not found' });
  });
});
