import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "../../ui/button";
import { formatCurrency, formatDateRange, type PriceBreakdown } from "../../../lib/date-utils";
import type { RentalConfirmation } from "../../../lib/validation";

interface ConfirmStepProps {
  itemName: string;
  from: Date;
  to: Date;
  price: PriceBreakdown;
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
  onConfirm: () => void;
}

export function ConfirmationStep({
  itemName,
  from,
  to,
  price,
  submitting,
  submitError,
  onBack,
  onConfirm,
}: ConfirmStepProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-2xl bg-secondary/50 p-5 text-sm">
        <Row label="Equipo" value={itemName} />
        <Row label="Fechas" value={formatDateRange(from, to)} />
        <Row label="Duración" value={`${price.days} ${price.days === 1 ? "día" : "días"}`} />
        <Row
          label={`Seguro inteligente (${Math.round(price.insuranceRate * 100)}%)`}
          value={formatCurrency(price.insurance)}
        />
        <Row label="Total a pagar" value={formatCurrency(price.total)} strong />
        <Row label="Depósito reembolsable" value={formatCurrency(price.deposit)} />
      </div>

      <p className="text-xs text-muted-foreground">
        Al confirmar aceptas los términos de renta. Esta es una demostración: no se realizará ningún cargo.
      </p>

      {submitError && (
        <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </p>
      )}

      <div className="flex gap-3">
        <Button variant="outline" size="lg" className="h-12 rounded-full" onClick={onBack} disabled={submitting}>
          Atrás
        </Button>
        <Button
          size="lg"
          className="h-12 flex-1 rounded-full bg-brand text-[15px] text-brand-foreground hover:bg-brand/90"
          onClick={onConfirm}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" /> Confirmando…
            </>
          ) : (
            "Confirmar Renta"
          )}
        </Button>
      </div>
    </div>
  );
}

export function RentalConfirmedState({
  itemName,
  confirmation,
  onReset,
}: {
  itemName: string;
  confirmation: RentalConfirmation;
  onReset: () => void;
}) {
  const from = new Date(`${confirmation.from}T00:00:00`);
  const to = new Date(`${confirmation.to}T00:00:00`);

  return (
    <div className="flex flex-col items-center py-4 text-center" role="status">
      <div className="grid size-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 motion-safe:animate-in motion-safe:zoom-in-50">
        <CheckCircle2 className="size-8" />
      </div>
      <h3 className="mt-5 text-2xl font-semibold">¡Renta confirmada!</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Tu {itemName} te espera del {formatDateRange(from, to)}.
      </p>

      <div className="mt-6 w-full rounded-2xl bg-secondary/50 p-5 text-sm">
        <p className="text-xs font-medium text-muted-foreground uppercase">Código de confirmación</p>
        <p className="mt-1 font-mono text-lg font-semibold tracking-wider">{confirmation.confirmationCode}</p>
        <p className="mt-3 text-muted-foreground">
          Total pagado: <span className="font-medium text-foreground">{formatCurrency(confirmation.total)}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Incluye seguro inteligente: <span className="font-medium">{formatCurrency(confirmation.insurance)}</span>
        </p>
      </div>

      <div className="mt-6 flex w-full gap-3">
        <Button variant="outline" size="lg" className="h-12 flex-1 rounded-full" onClick={onReset}>
          Nueva renta
        </Button>
        <Button asChild size="lg" className="h-12 flex-1 rounded-full">
          <Link href="/">Explorar más</Link>
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
