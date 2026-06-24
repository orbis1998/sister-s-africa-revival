import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchProductBySlug, type ProductWithVariants } from "@/lib/products";
import { fetchApprovedReviews } from "@/lib/reviews";
import { formatVariantLabel, type ProductVariant } from "@/lib/product-variants";
import { formatLineTotal, formatProductPrice, productUnitPrice, rdcCurrencyOf } from "@/lib/market";
import { useMarket } from "@/lib/market-context";
import { useMarketStock } from "@/lib/use-market-stock";
import { useCart } from "@/lib/cart";
import { ReviewForm } from "@/components/site/ReviewForm";
import { Reviews } from "@/components/site/Reviews";
import { RichContent } from "@/components/site/RichContent";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { buildSeoMeta } from "@/lib/seo";

export const Route = createFileRoute("/product/$slug")({
  head: ({ loaderData }) => {
    const product = loaderData?.product;
    return buildSeoMeta({
      title: product?.seo_title || `${product?.name ?? "Produit"} — The Sisters Africa`,
      description: product?.seo_description || product?.description || "Découvrez ce produit The Sisters Africa et commandez via WhatsApp.",
      image: product?.image_url ?? undefined,
      url: `https://thesistersafrica.com/product/${product?.slug ?? ""}`,
      type: "product",
    });
  },
  loader: async ({ params }) => {
    const product = await fetchProductBySlug(params.slug);
    if (!product) throw notFound();
    const reviews = await fetchApprovedReviews({ productSlug: params.slug, limit: 50 }).catch((error) => {
      console.error("Product reviews loader failed", error);
      return [];
    });
    return { product, reviews };
  },
  notFoundComponent: () => (
    <div className="container-page py-32 text-center">
      <h1 className="font-display text-4xl text-espresso mb-4">Produit introuvable</h1>
      <Link to="/products" className="btn-hero mt-4">Retour aux produits</Link>
    </div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { product, reviews: initialReviews } = Route.useLoaderData() as {
    product: ProductWithVariants;
    reviews: Awaited<ReturnType<typeof fetchApprovedReviews>>;
  };
  const { add, items } = useCart();
  const { countryCode } = useMarket();
  const { availableForVariant, isLoading: stockLoading, data: stockMap } = useMarketStock();
  const [qty, setQty] = useState(1);
  const [reviewRefresh, setReviewRefresh] = useState(0);
  const variants: ProductVariant[] = product.variants.length
    ? product.variants
    : [{
        id: product.id,
        product_id: product.id,
        weight_value: 1,
        weight_unit: "kg" as const,
        price_usd: product.price_usd,
        price_fcfa: product.price_fcfa,
        price_cdf: (product as any).price_cdf ?? 0,
        rdc_price_currency: (product as any).rdc_price_currency ?? "usd",
        sort_order: 0,
        is_active: true,
      }];
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0].id);
  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) ?? variants[0],
    [variants, selectedVariantId],
  );
  const available = availableForVariant(selectedVariant.id);
  const inCartQty = items.find((it) => it.slug === product.slug && it.variantId === selectedVariant.id)?.qty ?? 0;
  const remaining = Math.max(0, available - inCartQty);
  const outOfStock = !stockLoading && available <= 0;

  useEffect(() => {
    if (stockLoading || !stockMap) return;
    const firstAvailable = variants.find((v) => (stockMap[v.id] ?? 0) > 0);
    if (firstAvailable && (stockMap[selectedVariantId] ?? 0) <= 0) {
      setSelectedVariantId(firstAvailable.id);
    }
  }, [variants, selectedVariantId, stockLoading, stockMap]);

  useEffect(() => {
    if (remaining > 0 && qty > remaining) setQty(remaining);
  }, [remaining, qty]);

  function addToCart() {
    if (outOfStock) {
      toast.error("Fini en stock");
      return;
    }
    if (qty > remaining) {
      toast.error(remaining > 0 ? `Stock limité : ${remaining} disponible(s)` : "Fini en stock");
      return;
    }
    const rdcCurrency = rdcCurrencyOf(selectedVariant);
    add(
      {
        slug: product.slug,
        name: product.name,
        variantId: selectedVariant.id,
        variantLabel: formatVariantLabel(selectedVariant.weight_value, selectedVariant.weight_unit),
        priceFcfa: selectedVariant.price_fcfa,
        priceUsd: selectedVariant.price_usd,
        priceCdf: selectedVariant.price_cdf ?? 0,
        rdcCurrency,
        image: product.image_url ?? "",
      },
      qty,
    );
    toast.success(`${product.name} (${formatVariantLabel(selectedVariant.weight_value, selectedVariant.weight_unit)}) ajouté au panier`);
  }

  return (
    <>
      <div className="container-page pt-8">
        <Link to="/products" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-copper">
          <ArrowLeft className="w-3.5 h-3.5" /> Produits
        </Link>
      </div>

      <section className="container-page py-12 grid lg:grid-cols-2 gap-16">
        <div className="bg-clay/40 aspect-square rounded-sm overflow-hidden">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" width={1024} height={1024} />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-8 text-center font-display text-5xl text-espresso/40">
              {product.name}
            </div>
          )}
        </div>

        <div>
          <div className="eyebrow mb-3">Produit</div>
          <h1 className="font-display text-5xl text-espresso mb-3">{product.name}</h1>
          {product.is_bestseller && <p className="text-muted-foreground mb-8">Best-seller The Sisters Africa</p>}

          <div className="flex items-baseline gap-3 mb-3">
            <span className="font-display text-4xl text-copper">{formatProductPrice(selectedVariant, countryCode)}</span>
          </div>

          {outOfStock && (
            <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              Fini en stock — ce produit n&apos;est plus disponible pour le moment dans votre région.
            </div>
          )}

          {variants.length > 1 && (
            <div className="mb-8">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Choisir le poids</div>
              <div className="grid gap-2">
                {variants.map((variant) => {
                  const active = variant.id === selectedVariantId;
                  const unit = productUnitPrice(variant, countryCode);
                  const variantAvailable = availableForVariant(variant.id);
                  const variantOut = !stockLoading && variantAvailable <= 0;
                  return (
                    <label
                      key={variant.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition ${
                        active ? "border-copper bg-copper/10" : "border-border hover:border-copper/40"
                      } ${variantOut ? "opacity-60" : ""}`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="variant"
                          checked={active}
                          disabled={variantOut}
                          onChange={() => setSelectedVariantId(variant.id)}
                          className="accent-copper"
                        />
                        <span className="font-medium">
                          {formatVariantLabel(variant.weight_value, variant.weight_unit)}
                          {variantOut ? " — Fini en stock" : ""}
                        </span>
                      </span>
                      <span className="text-sm text-copper">{formatLineTotal(unit.amount, unit.label)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center border border-border rounded-sm">
              <button type="button" disabled={outOfStock || qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-4 py-3 text-espresso hover:text-copper disabled:opacity-40">−</button>
              <span className="px-4 text-sm w-10 text-center">{qty}</span>
              <button type="button" disabled={outOfStock || qty >= remaining} onClick={() => setQty((q) => Math.min(remaining, q + 1))} className="px-4 py-3 text-espresso hover:text-copper disabled:opacity-40">+</button>
            </div>
            <button type="button" onClick={addToCart} disabled={outOfStock || remaining <= 0} className="btn-hero flex-1 disabled:opacity-50">
              <ShoppingBag className="w-4 h-4" /> {outOfStock ? "Fini en stock" : "Ajouter au panier"}
            </button>
          </div>

          {(product.content_html || product.description) && (
            <div className="mb-8">
              {product.content_html ? (
                <RichContent html={product.content_html} />
              ) : (
                <p className="text-espresso/80 leading-relaxed">{product.description}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="button" onClick={addToCart} disabled={outOfStock || remaining <= 0} className="btn-hero w-full disabled:opacity-50">
              <ShoppingBag className="w-4 h-4" /> {outOfStock ? "Fini en stock" : "Ajouter au panier"}
            </button>
          </div>
        </div>
      </section>
      <section className="container-page pb-20 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <Reviews productSlug={product.slug} refreshKey={reviewRefresh} initialReviews={initialReviews} />
        <ReviewForm productSlug={product.slug} onSubmitted={() => setReviewRefresh((v) => v + 1)} />
      </section>
    </>
  );
}
