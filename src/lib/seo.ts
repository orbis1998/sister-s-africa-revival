export const SITE_NAME = "The Sisters Africa";

export type SeoInput = {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: "website" | "article" | "product";
  twitterHandle?: string;
  noindex?: boolean;
};

export function buildSeoMeta(input: SeoInput = {}) {
  const title = input.title ?? `${SITE_NAME} — Bouillies bio pour une prise de poids saine`;
  const description =
    input.description ??
    "Mass Gainer, Super Grow et Peanut Butter : bouillies bio d'origine végétale. Livraison à Kinshasa, Lubumbashi, Brazzaville et Pointe-Noire.";
  const image = input.image ?? "https://thesistersafrica.com/og-default.jpg";
  const url = input.url ?? "https://thesistersafrica.com";
  const type = input.type ?? "website";
  const twitter = input.twitterHandle ?? "@thesistersafrica";

  const meta: Array<Record<string, string>> = [
    { charSet: "utf-8" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { title },
    { name: "description", content: description },
    { name: "keywords", content: input.keywords ?? "The Sisters Africa, bouillie bio, prise de poids, Mass Gainer, Super Grow" },
    { name: "author", content: SITE_NAME },
    { name: "robots", content: input.noindex ? "noindex,nofollow" : "index,follow" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    { property: "og:locale", content: "fr_FR" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:site", content: twitter },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];

  return {
    meta,
    links: [{ rel: "canonical", href: url }],
  };
}

export function orderCollectTotal(order: {
  total_fcfa?: number | null;
  total_usd?: number | null;
  delivery_fee_fcfa?: number | null;
  delivery_fee_usd?: number | null;
}) {
  return {
    products_fcfa: Number(order.total_fcfa ?? 0),
    products_usd: Number(order.total_usd ?? 0),
    delivery_fcfa: Number(order.delivery_fee_fcfa ?? 0),
    delivery_usd: Number(order.delivery_fee_usd ?? 0),
    collect_fcfa: Number(order.total_fcfa ?? 0) + Number(order.delivery_fee_fcfa ?? 0),
    collect_usd: Number(order.total_usd ?? 0) + Number(order.delivery_fee_usd ?? 0),
  };
}

export function formatCollectLabel(
  order: Parameters<typeof orderCollectTotal>[0],
  currency: "FCFA" | "USD" = "USD",
) {
  const t = orderCollectTotal(order);
  if (currency === "FCFA") {
    return `${t.collect_fcfa.toLocaleString("fr-FR")} FCFA (produits ${t.products_fcfa.toLocaleString("fr-FR")} + livraison ${t.delivery_fcfa.toLocaleString("fr-FR")})`;
  }
  return `$${t.products_usd.toFixed(2)} + ${t.delivery_fcfa.toLocaleString("fr-FR")} CDF`;
}
