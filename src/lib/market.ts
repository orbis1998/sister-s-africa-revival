export type MarketCountry = "CD" | "CG";
export type RdcPriceCurrency = "usd" | "cdf";

export const MARKET_STORAGE_KEY = "ts-market-v1";

export type MarketState = {
  countryCode: MarketCountry;
  source: "ip" | "manual" | "checkout";
};

export function normalizeMarketCountry(code?: string | null): MarketCountry {
  return code === "CG" ? "CG" : "CD";
}

export function loadStoredMarket(): MarketState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MARKET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MarketState;
    if (parsed.countryCode === "CD" || parsed.countryCode === "CG") return parsed;
  } catch {}
  return null;
}

export function saveStoredMarket(state: MarketState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MARKET_STORAGE_KEY, JSON.stringify(state));
}

export type PriceLike = {
  price_usd?: number | null;
  price_fcfa?: number | null;
  price_cdf?: number | null;
  rdc_price_currency?: RdcPriceCurrency | string | null;
};

export function rdcCurrencyOf(item: PriceLike): RdcPriceCurrency {
  return item.rdc_price_currency === "cdf" ? "cdf" : "usd";
}

export function productUnitPrice(item: PriceLike, market: MarketCountry) {
  if (market === "CG") {
    return { amount: Number(item.price_fcfa ?? 0), label: "FCFA" as const };
  }
  if (rdcCurrencyOf(item) === "cdf") {
    return { amount: Number(item.price_cdf ?? 0), label: "CDF" as const };
  }
  return { amount: Number(item.price_usd ?? 0), label: "USD" as const };
}

export function formatMoney(amount: number, label: "USD" | "CDF" | "FCFA") {
  if (label === "USD") return `$${Number(amount).toFixed(2)}`;
  return `${Number(amount).toLocaleString("fr-FR")} ${label}`;
}

export function formatProductPrice(item: PriceLike, market: MarketCountry) {
  const { amount, label } = productUnitPrice(item, market);
  return formatMoney(amount, label);
}

function formatCompactMoney(amount: number, label: "USD" | "CDF" | "FCFA") {
  if (label === "USD") {
    const n = Number(amount);
    return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
  }
  return `${Number(amount).toLocaleString("fr-FR")} ${label}`;
}

/** Min–max across variants, e.g. $15 – $25 when prices differ. */
export function formatProductPriceRange(variants: PriceLike[], market: MarketCountry) {
  if (!variants.length) return formatProductPrice({}, market);
  const priced = variants.map((v) => productUnitPrice(v, market));
  const min = Math.min(...priced.map((p) => p.amount));
  const max = Math.max(...priced.map((p) => p.amount));
  const label = priced[0]!.label;
  if (min === max) return formatCompactMoney(min, label);
  return `${formatCompactMoney(min, label)} – ${formatCompactMoney(max, label)}`;
}

export function formatLineTotal(amount: number, label: "USD" | "CDF" | "FCFA", qty = 1) {
  return formatMoney(amount * qty, label);
}

export type CartPricingItem = PriceLike & { qty: number; name: string; variantLabel?: string };

export function cartTotals(items: CartPricingItem[], market: MarketCountry) {
  if (market === "CG") {
    const fcfa = items.reduce((s, i) => s + Number(i.price_fcfa ?? 0) * i.qty, 0);
    return { fcfa, usd: 0, cdf: 0, primaryLabel: "FCFA" as const, primaryAmount: fcfa };
  }
  const usd = items
    .filter((i) => rdcCurrencyOf(i) === "usd")
    .reduce((s, i) => s + Number(i.price_usd ?? 0) * i.qty, 0);
  const cdf = items
    .filter((i) => rdcCurrencyOf(i) === "cdf")
    .reduce((s, i) => s + Number(i.price_cdf ?? 0) * i.qty, 0);
  return { fcfa: 0, usd, cdf, primaryLabel: usd > 0 && cdf > 0 ? "MIXED" as const : cdf > 0 ? "CDF" as const : "USD" as const, primaryAmount: 0 };
}

export function formatDeliveryFee(amount: number, market: MarketCountry) {
  return market === "CG"
    ? formatMoney(amount, "FCFA")
    : formatMoney(amount, "CDF");
}

export function formatCheckoutCollect(
  items: CartPricingItem[],
  market: MarketCountry,
  deliveryFee: number,
) {
  const t = cartTotals(items, market);
  if (market === "CG") {
    const total = t.fcfa + deliveryFee;
    return {
      productsLabel: formatMoney(t.fcfa, "FCFA"),
      deliveryLabel: formatDeliveryFee(deliveryFee, market),
      totalLabel: formatMoney(total, "FCFA"),
      whatsappProductsLines: items.map((it) => {
        const line = productUnitPrice(it, market);
        return `• ${it.qty} × ${it.name}${it.variantLabel ? ` — ${it.variantLabel}` : ""} : ${formatLineTotal(line.amount, line.label, it.qty)}`;
      }),
      whatsappSubtotal: `*Sous-total produits : ${formatMoney(t.fcfa, "FCFA")}*`,
      whatsappDelivery: deliveryFee ? `*Frais livraison : ${formatDeliveryFee(deliveryFee, market)}*` : "",
      whatsappTotal: `*Total à encaisser : ${formatMoney(total, "FCFA")}*`,
    };
  }

  const parts: string[] = [];
  if (t.usd > 0) parts.push(formatMoney(t.usd, "USD"));
  if (t.cdf > 0) parts.push(formatMoney(t.cdf, "CDF"));
  const deliveryLabel = formatDeliveryFee(deliveryFee, market);
  const totalParts = [...parts];
  if (deliveryFee) totalParts.push(deliveryLabel.replace("*", ""));

  return {
    productsLabel: parts.join(" + ") || "$0.00",
    deliveryLabel,
    totalLabel: totalParts.join(" + ") || "$0.00",
    whatsappProductsLines: items.map((it) => {
      const line = productUnitPrice(it, market);
      return `• ${it.qty} × ${it.name}${it.variantLabel ? ` — ${it.variantLabel}` : ""} : ${formatLineTotal(line.amount, line.label, it.qty)}`;
    }),
    whatsappSubtotal: `*Sous-total produits : ${parts.join(" + ") || "$0.00"}*`,
    whatsappDelivery: deliveryFee ? `*Frais livraison : ${deliveryLabel}*` : "",
    whatsappTotal: `*Total à encaisser : ${[...parts, deliveryFee ? deliveryLabel : ""].filter(Boolean).join(" + ")}*`,
  };
}
