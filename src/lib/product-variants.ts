export type WeightUnit = "g" | "kg";

import type { RdcPriceCurrency } from "@/lib/market";

export type ProductVariant = {
  id: string;
  product_id: string;
  weight_value: number;
  weight_unit: WeightUnit;
  price_usd: number;
  price_fcfa: number;
  price_cdf: number;
  rdc_price_currency: RdcPriceCurrency;
  sort_order: number;
  is_active: boolean;
};

export function formatVariantLabel(weightValue: number, weightUnit: WeightUnit) {
  const value = Number(weightValue);
  if (weightUnit === "kg") {
    const text = Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
    return `${text} kg`;
  }
  return `${Math.round(value)} g`;
}

export function variantSortKey(weightValue: number, weightUnit: WeightUnit) {
  return weightUnit === "kg" ? valueToGrams(weightValue, weightUnit) : weightValue;
}

export function valueToGrams(weightValue: number, weightUnit: WeightUnit) {
  return weightUnit === "kg" ? Number(weightValue) * 1000 : Number(weightValue);
}

export function sortVariants<T extends Pick<ProductVariant, "weight_value" | "weight_unit" | "sort_order">>(variants: T[]) {
  return [...variants].sort((a, b) => {
    const order = a.sort_order - b.sort_order;
    if (order !== 0) return order;
    return variantSortKey(a.weight_value, a.weight_unit) - variantSortKey(b.weight_value, b.weight_unit);
  });
}

export function defaultVariant<T extends ProductVariant>(variants: T[]) {
  const active = sortVariants(variants.filter((v) => v.is_active));
  return active[0] ?? null;
}
