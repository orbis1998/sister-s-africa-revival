export const STAFF_DIRECTIONS = [
  { value: "kinshasa", label: "Kinshasa", countryCode: "CD", currency: "USD" },
  { value: "katanga", label: "Katanga", countryCode: "CD", currency: "USD" },
  { value: "brazzaville", label: "Brazzaville", countryCode: "CG", currency: "FCFA" },
  { value: "pointe-noire", label: "Pointe-Noire", countryCode: "CG", currency: "FCFA" },
] as const;

export type StaffDirection = (typeof STAFF_DIRECTIONS)[number]["value"];

const KATANGA_CITIES = new Set(["Lubumbashi", "Kolwezi", "Likasi", "Katanga"]);

export function directionFromCity(city?: string | null, countryCode?: string | null): StaffDirection | null {
  if (!city) return null;
  if (city === "Kinshasa") return "kinshasa";
  if (KATANGA_CITIES.has(city)) return "katanga";
  if (city === "Brazzaville") return "brazzaville";
  if (city === "Pointe-Noire" || city === "Pointe noir" || city === "Pointe Noire") return "pointe-noire";
  if (countryCode === "CG") return "brazzaville";
  if (countryCode === "CD") return "kinshasa";
  return null;
}

export function directionLabel(direction?: string | null) {
  return STAFF_DIRECTIONS.find((d) => d.value === direction)?.label ?? "Non définie";
}

export function directionCurrency(direction?: string | null) {
  return STAFF_DIRECTIONS.find((d) => d.value === direction)?.currency ?? "USD";
}

/** Devise locale pour les frais de livraison : CDF (RDC) ou FCFA (Congo). */
export function directionDeliveryCurrency(direction?: string | null): "CDF" | "FCFA" {
  return directionCurrency(direction) === "FCFA" ? "FCFA" : "CDF";
}

export function formatDeliveryFee(amount: number, direction?: string | null) {
  const currency = directionDeliveryCurrency(direction);
  return currency === "FCFA"
    ? `${Number(amount).toLocaleString("fr-FR")} FCFA`
    : `${Number(amount).toLocaleString("fr-FR")} CDF`;
}

export function formatDeliveryFeeByCountry(amount: number, countryCode?: string | null) {
  return countryCode === "CG"
    ? `${Number(amount).toLocaleString("fr-FR")} FCFA`
    : `${Number(amount).toLocaleString("fr-FR")} CDF`;
}

export function formatScopedMoney(value: { total_usd?: number | null; total_fcfa?: number | null }, direction?: string | null) {
  return directionCurrency(direction) === "FCFA"
    ? `${Number(value.total_fcfa ?? 0).toLocaleString("fr-FR")} FCFA`
    : `$${Number(value.total_usd ?? 0).toFixed(2)}`;
}
