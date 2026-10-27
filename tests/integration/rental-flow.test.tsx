// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { useEffect, useState, type ComponentProps } from "react";
import { toast } from "sonner";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getAvailability } from "@/app/api/availability/[id]/route";
import { POST as postRental } from "@/app/api/rentals/route";
import { CategoryButtons } from "@/components/features/CategoryButtons";
import { GearGrid } from "@/components/features/GearGrid";
import { RentalFlow } from "@/components/features/RentalFlow";
import { Toaster } from "@/components/ui/sonner";
import { CATEGORIES } from "@/config/categories";
import { calculateRentalPrice, formatCurrency, toISORanges } from "@/lib/date-utils";
import { inventoryService } from "@/services/inventoryService";
import type { CategoryId } from "@/types/gear";

/** Minimal in-memory router so links behave like client-side navigation. */
const router = vi.hoisted(() => ({ pathname: "/", navigate: (() => {}) as (href: string) => void }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        event.preventDefault();
        router.navigate(href);
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => router.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

// GearImage is an async Server Component (image resolution); it has its own edge-case tests.
vi.mock("@/components/features/GearImage/GearImage", () => ({
  GearImage: ({ item }: { item: { name: string } }) => <div role="img" aria-label={item.name} />,
}));

// The mock booking API waits 900 ms to feel real; tests don't need to.
vi.mock("@/services/rentalService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/rentalService")>();
  return { ...actual, rentalService: actual.createRentalService({ latencyMs: 0 }) };
});

const TODAY = new Date(2026, 5, 3, 10, 0); // Wed, June 3, 2026
const ITEM = inventoryService.getByIdOrThrow("starboard-touring-126");
const CATEGORY = CATEGORIES[ITEM.category];

function TestApp({ initialPath }: { initialPath: string }) {
  const [path, setPath] = useState(initialPath);
  useEffect(() => {
    router.navigate = (href) => {
      router.pathname = href;
      setPath(href);
    };
  }, []);

  return (
    <>
      <Toaster />
      <main data-path={path}>{renderRoute(path)}</main>
    </>
  );
}

function renderRoute(path: string) {
  const category = path.match(/^\/category\/([^/]+)$/)?.[1];
  if (category) return <GearGrid items={inventoryService.getByCategory(category as CategoryId)} />;

  const gearId = path.match(/^\/gear\/([^/]+)$/)?.[1];
  if (gearId) {
    const item = inventoryService.getByIdOrThrow(gearId);
    // The whole item (a superset of what the page passes), so logic keyed on any field is exercised.
    return <RentalFlow item={item} initialBookedRanges={toISORanges(inventoryService.getAvailability(item.id))} />;
  }
  return <CategoryButtons />;
}

// --- Backend: real route handlers behind a fetch stub -------------------------------------

type Override = (request: Request) => Response | Promise<Response> | undefined;
let override: Override | undefined;
let requests: { method: string; path: string; body: unknown }[] = [];

async function backend(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(new URL(String(input), "http://localhost"), init);
  const path = new URL(request.url).pathname;
  requests.push({ method: request.method, path, body: request.body ? await request.clone().json() : undefined });

  const overridden = await override?.(request);
  if (overridden) return overridden;

  const availabilityId = path.match(/^\/api\/availability\/([^/]+)$/)?.[1];
  if (availabilityId && request.method === "GET") {
    return getAvailability(request, { params: Promise.resolve({ id: availabilityId }) });
  }
  if (path === "/api/rentals" && request.method === "POST") return postRental(request);
  return new Response("Not found", { status: 404 });
}

const rentalRequests = () => requests.filter((r) => r.method === "POST" && r.path === "/api/rentals");

// --- DOM helpers ----------------------------------------------------------------------------

const toastsOfType = (type: "success" | "error") =>
  [...document.querySelectorAll(`[data-sonner-toast][data-type="${type}"]`)].map((t) => t.textContent ?? "");

function dayButton(isoDay: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`button[data-day="${isoDay}"]`);
  if (!button) throw new Error(`Calendar day ${isoDay} is not rendered`);
  return button;
}

async function pickDates(user: UserEvent, from: string, to: string) {
  await user.click(dayButton(from));
  await user.click(dayButton(to));
}

/** From the gear page: pick dates → summary → confirmation step. */
async function goToConfirmation(user: UserEvent, from: string, to: string) {
  await pickDates(user, from, to);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  return screen.getByRole("button", { name: "Confirmar Renta" });
}

function renderApp(initialPath = "/") {
  router.pathname = initialPath;
  return { user: userEvent.setup(), ...render(<TestApp initialPath={initialPath} />) };
}

// --- Tests ----------------------------------------------------------------------------------

beforeAll(() => {
  // jsdom has no matchMedia; sonner uses it to follow the system color scheme.
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  // Sonner keeps toasts in module state and replays active ones to a newly mounted Toaster.
  toast.dismiss();
  override = undefined;
  requests = [];
  vi.stubGlobal("fetch", vi.fn(backend));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rental flow", () => {
  it("rents water-sports gear end to end: category → item → dates → Confirmar → success toast", async () => {
    const { user } = renderApp("/");

    await user.click(screen.getByRole("link", { name: new RegExp(CATEGORY.name) }));
    expect(router.pathname).toBe(`/category/${CATEGORY.id}`);
    expect(screen.getByText(`${inventoryService.getByCategory(CATEGORY.id).length} resultados`)).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: new RegExp(ITEM.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }));
    expect(router.pathname).toBe(`/gear/${ITEM.id}`);

    await pickDates(user, "2026-06-10", "2026-06-12");
    expect(screen.getByText(/3 días/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    const expected = calculateRentalPrice(ITEM.dailyRate, new Date(2026, 5, 10), new Date(2026, 5, 12), ITEM.deposit);
    expect(expected.total).toBe(145.8);
    expect(screen.getByText(`${formatCurrency(ITEM.dailyRate)} × 3 días`)).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(expected.total))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(toastsOfType("success")).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Confirmar Renta" }));

    await waitFor(() => expect(toastsOfType("success")).toHaveLength(1));
    const [successToast] = toastsOfType("success");
    expect(successToast).toContain("¡Renta confirmada!");
    expect(successToast).toMatch(new RegExp(`${formatCurrency(145.8).replace("$", "\\$")} · RMG-[A-Z0-9]+`));
    expect(toastsOfType("error")).toEqual([]);

    const confirmed = screen.getByRole("status");
    expect(within(confirmed).getByText("¡Renta confirmada!")).toBeInTheDocument();
    expect(within(confirmed).getByText(formatCurrency(145.8))).toBeInTheDocument();
    expect(rentalRequests()).toEqual([
      { method: "POST", path: "/api/rentals", body: { itemId: ITEM.id, from: "2026-06-10", to: "2026-06-12" } },
    ]);
  });

  it("keeps Continuar disabled without dates; one click is a same-day (1 día) rental", async () => {
    const { user } = renderApp(`/gear/${ITEM.id}`);

    const continueButton = screen.getByRole("button", { name: "Continuar" });
    expect(continueButton).toBeDisabled();

    await user.click(dayButton("2026-06-10"));
    expect(screen.getByText(/· 1 día$/)).toBeInTheDocument();
    expect(continueButton).toBeEnabled();

    await user.click(dayButton("2026-06-10")); // clicking the same day again clears the selection
    expect(screen.getByText("Elige la fecha de recogida")).toBeInTheDocument();
    expect(continueButton).toBeDisabled();
    expect(rentalRequests()).toEqual([]);
  });

  it("does not let the calendar build a range longer than 30 days", async () => {
    const { user } = renderApp(`/gear/${ITEM.id}`);

    await user.click(dayButton("2026-06-04"));
    await user.click(screen.getByRole("button", { name: "Ir al mes siguiente" }));
    await user.click(dayButton("2026-07-05")); // 32 days → the picker restarts the range here

    expect(screen.getByText("Elige la fecha de devolución")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    expect(toastsOfType("success")).toEqual([]);
  });

  it("blocks the booking when someone else reserved those dates in the meantime", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { user } = renderApp(`/gear/${ITEM.id}`);
    const confirm = await goToConfirmation(user, "2026-06-10", "2026-06-12");

    override = (request) =>
      request.url.includes("/api/availability/")
        ? Response.json({
            itemId: ITEM.id,
            bookedRanges: toISORanges([{ from: new Date(2026, 5, 11), to: new Date(2026, 5, 11) }]),
            checkedAt: TODAY.toISOString(),
          })
        : undefined;
    await user.click(confirm);

    await waitFor(() => expect(toastsOfType("error")).toEqual([expect.stringContaining("Esas fechas ya no están disponibles")]));
    expect(screen.getByRole("alert")).toHaveTextContent("Alguien acaba de reservar parte de esas fechas");
    expect(dayButton("2026-06-11")).toBeDisabled();
    expect(rentalRequests()).toEqual([]);
    expect(toastsOfType("success")).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("shows the server's 422 instead of a success toast when the dates went stale overnight", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { user } = renderApp(`/gear/${ITEM.id}`);
    const confirm = await goToConfirmation(user, "2026-06-03", "2026-06-05");

    vi.setSystemTime(new Date(2026, 5, 4, 0, 5)); // past midnight: pickup "today" is now yesterday
    await user.click(confirm);

    await waitFor(() => expect(toastsOfType("error")).toEqual([expect.stringContaining("Solicitud inválida")]));
    expect(screen.getByRole("alert")).toHaveTextContent("La fecha de inicio no puede estar en el pasado");
    expect(rentalRequests()).toHaveLength(1);
    expect(toastsOfType("success")).toEqual([]);
    expect(warn).toHaveBeenCalledWith("[RentalFlow] rental rejected", expect.objectContaining({ status: 422 }));
  });

  it("rejects a malformed confirmation from the server", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { user } = renderApp(`/gear/${ITEM.id}`);
    const confirm = await goToConfirmation(user, "2026-06-10", "2026-06-12");

    override = (request) =>
      request.method === "POST" ? Response.json({ ok: true }, { status: 201 }) : undefined;
    await user.click(confirm);

    await waitFor(() => expect(toastsOfType("error")).toHaveLength(1));
    expect(toastsOfType("success")).toEqual([]);
    expect(screen.queryByText("Código de confirmación")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar Renta" })).toBeEnabled();
    expect(error).toHaveBeenCalledWith("[RentalFlow] rental request failed", expect.anything());
  });

  it("recovers from a network failure without a success toast", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { user } = renderApp(`/gear/${ITEM.id}`);
    const confirm = await goToConfirmation(user, "2026-06-10", "2026-06-12");

    override = (request) => {
      if (request.method === "POST") throw new TypeError("Failed to fetch");
      return undefined;
    };
    await user.click(confirm);

    await waitFor(() => expect(toastsOfType("error")).toEqual([expect.stringContaining("Error de conexión")]));
    expect(screen.getByRole("alert")).toHaveTextContent("Error de conexión. Inténtalo de nuevo.");
    expect(screen.getByRole("button", { name: "Confirmar Renta" })).toBeEnabled();
    expect(toastsOfType("success")).toEqual([]);
  });
});
