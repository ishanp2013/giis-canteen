const aed = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" });

/** Formats an amount in AED, e.g. 12.5 -> "AED 12.50". */
export function formatAED(amount: number): string {
  return aed.format(amount);
}
