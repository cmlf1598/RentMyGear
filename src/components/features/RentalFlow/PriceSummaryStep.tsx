import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDateRange, type PriceBreakdown } from "@/lib/date-utils";

interface PriceSummaryStepProps {
  from: Date;
  to: Date;
  price: PriceBreakdown;
  onBack: () => void;
  onContinue: () => void;
}

export function PriceSummaryStep({ from, to, price, onBack, onContinue }: PriceSummaryStepProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-secondary/50 p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase">Periodo</p>
        <p className="mt-1 font-medium">{formatDateRange(from, to)}</p>
      </div>

      <dl className="space-y-3 text-sm">
        {price.lineItems.map((line) => (
          <div key={line.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(line.amount)}</dd>
          </div>
        ))}
        <Separator />
        <div className="flex justify-between gap-4 text-base">
          <dt className="font-semibold">Total</dt>
          <dd className="font-semibold tabular-nums">{formatCurrency(price.total)}</dd>
        </div>
      </dl>

      <div className="flex gap-3 rounded-2xl border border-border/70 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
        <p className="text-muted-foreground">
          Depósito reembolsable de <span className="font-medium text-foreground">{formatCurrency(price.deposit)}</span>.
          Se retiene al recoger el equipo y se libera al devolverlo en buen estado.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" size="lg" className="h-12 flex-1 rounded-full" onClick={onBack}>
          Cambiar fechas
        </Button>
        <Button size="lg" className="h-12 flex-1 rounded-full" onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
