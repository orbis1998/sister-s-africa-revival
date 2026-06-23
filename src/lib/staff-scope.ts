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

export function regionUsesFcfa(region: { scopes: readonly StaffDirection[] }) {
  return directionCurrency(region.scopes[0]) === "FCFA";
}

export function formatRegionMoney(
  value: { usd?: number | null; fcfa?: number | null },
  region: { scopes: readonly StaffDirection[] },
) {
  return regionUsesFcfa(region)
    ? `${Number(value.fcfa ?? 0).toLocaleString("fr-FR")} FCFA`
    : `$${Number(value.usd ?? 0).toFixed(2)}`;
}

/** Montant commande selon la région : RDC → USD, Congo → FCFA. */
export function formatOrderAmount(order: {
  total_fcfa?: number | null;
  total_usd?: number | null;
  delivery_fee_fcfa?: number | null;
  delivery_fee_usd?: number | null;
  city?: string | null;
  country_code?: string | null;
  city_scope?: string | null;
}) {
  const scope = (order.city_scope as StaffDirection | null) ?? directionFromCity(order.city, order.country_code);
  const productsFcfa = Number(order.total_fcfa ?? 0);
  const productsUsd = Number(order.total_usd ?? 0);
  const deliveryFcfa = Number(order.delivery_fee_fcfa ?? 0);
  const deliveryUsd = Number(order.delivery_fee_usd ?? 0);
  if (directionCurrency(scope) === "FCFA") {
    return `${(productsFcfa + deliveryFcfa).toLocaleString("fr-FR")} FCFA`;
  }
  return `$${(productsUsd + deliveryUsd).toFixed(2)}`;
}

/** Regroupement admin : Congo (Brazzaville + Pointe-Noire) sous « RD Congo ». */
export const ADMIN_REPORT_REGIONS = [
  { key: "kinshasa", label: "Kinshasa", scopes: ["kinshasa"] as StaffDirection[] },
  { key: "katanga", label: "Katanga", scopes: ["katanga"] as StaffDirection[] },
  { key: "rd-congo", label: "RD Congo", scopes: ["brazzaville", "pointe-noire"] as StaffDirection[] },
] as const;

export function regionLabelForScope(scope?: string | null) {
  const region = ADMIN_REPORT_REGIONS.find((r) => r.scopes.includes(scope as StaffDirection));
  return region?.label ?? directionLabel(scope);
}

export function aggregateByAdminRegion<T extends { city_scope?: string | null }>(rows: T[]) {
  return ADMIN_REPORT_REGIONS.map((region) => ({
    region,
    rows: rows.filter((row) => region.scopes.includes(row.city_scope as StaffDirection)),
  }));
}
