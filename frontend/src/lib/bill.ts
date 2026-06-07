// Bill total calculation with service charge + VAT.
// Convention: service charge applies on subtotal; VAT applies on (subtotal + service).

export interface BillBreakdown {
  subtotal: number;
  serviceCharge: number;
  vat: number;
  grandTotal: number;
  serviceChargePct: number;
  vatPct: number;
}

export function calculateBill(
  subtotal: number,
  serviceChargePct: number,
  vatPct: number,
): BillBreakdown {
  const safeService = Math.max(0, Number(serviceChargePct) || 0);
  const safeVat = Math.max(0, Number(vatPct) || 0);
  const serviceCharge = round2((subtotal * safeService) / 100);
  const vat = round2(((subtotal + serviceCharge) * safeVat) / 100);
  const grandTotal = round2(subtotal + serviceCharge + vat);
  return {
    subtotal: round2(subtotal),
    serviceCharge,
    vat,
    grandTotal,
    serviceChargePct: safeService,
    vatPct: safeVat,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
