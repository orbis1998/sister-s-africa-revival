import { createFileRoute, Link } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";
import { cartTotals, formatLineTotal, formatMoney, productUnitPrice } from "@/lib/market";
import { useMarket } from "@/lib/market-context";
import { Trash2, ArrowRight, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Panier — The Sisters Africa" }] }),
  component: CartPage,
});

function CartPage() {
  const { items, setQty, remove, totalFcfa, totalUsd, totalCdf } = useCart();
  const { countryCode } = useMarket();
  const pricingItems = items.map((it) => ({
    ...it,
    price_usd: it.priceUsd,
    price_fcfa: it.priceFcfa,
    price_cdf: it.priceCdf,
    rdc_price_currency: it.rdcCurrency,
  }));
  const totals = cartTotals(pricingItems, countryCode);

  if (items.length === 0) {
    return (
      <section className="container-page py-32 text-center">
        <ShoppingBag className="w-12 h-12 text-copper mx-auto mb-6" strokeWidth={1} />
        <h1 className="font-display text-4xl text-espresso mb-4">Votre panier est vide</h1>
        <p className="text-muted-foreground mb-8">Découvrez nos formules pour commencer votre transformation.</p>
        <Link to="/products" className="btn-hero">Aller à la boutique</Link>
      </section>
    );
  }

  const subtotalLabel = countryCode === "CG"
    ? formatMoney(totals.fcfa, "FCFA")
    : [totals.usd > 0 ? formatMoney(totals.usd, "USD") : "", totals.cdf > 0 ? formatMoney(totals.cdf, "CDF") : ""].filter(Boolean).join(" + ");

  return (
    <section className="container-page overflow-x-hidden py-14 sm:py-20">
      <div className="eyebrow mb-3">Panier</div>
      <h1 className="font-display text-4xl text-espresso mb-8 sm:mb-12 sm:text-5xl">Votre sélection</h1>

      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6">
          {items.map((it) => {
            const unit = productUnitPrice({
              price_usd: it.priceUsd,
              price_fcfa: it.priceFcfa,
              price_cdf: it.priceCdf,
              rdc_price_currency: it.rdcCurrency,
            }, countryCode);
            return (
              <div key={`${it.slug}-${it.variantId}`} className="rounded-2xl border border-border bg-card p-4 sm:flex sm:gap-6 sm:p-5">
                <div className="h-40 w-full overflow-hidden rounded-xl bg-clay/40 sm:h-24 sm:w-24 sm:shrink-0">
                  <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                </div>
                <div className="mt-4 min-w-0 flex-1 sm:mt-0">
                  <h3 className="font-display text-xl text-espresso">{it.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{it.variantLabel}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="flex items-center border border-border rounded-sm">
                      <button onClick={() => setQty(it.slug, it.variantId, it.qty - 1)} className="px-3 py-1.5 text-sm">−</button>
                      <span className="px-3 text-sm w-8 text-center">{it.qty}</span>
                      <button onClick={() => setQty(it.slug, it.variantId, it.qty + 1)} className="px-3 py-1.5 text-sm">+</button>
                    </div>
                    <button
                      onClick={() => remove(it.slug, it.variantId)}
                      className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Retirer
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-4 text-right sm:mt-0 sm:block sm:border-0 sm:pt-0">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground sm:hidden">Total article</span>
                  <div className="font-medium text-espresso">{formatLineTotal(unit.amount, unit.label, it.qty)}</div>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="bg-card border border-border rounded-2xl p-5 h-fit sm:p-8 lg:sticky lg:top-28">
          <h2 className="font-display text-2xl text-espresso mb-6">Récapitulatif</h2>
          <div className="space-y-3 mb-6 pb-6 border-b border-border">
            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:justify-between">
              <span className="text-muted-foreground">Sous-total</span>
              <span className="text-espresso">{subtotalLabel}</span>
            </div>
            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:justify-between">
              <span className="text-muted-foreground">Livraison</span>
              <span className="text-espresso">Calculée à l'étape suivante</span>
            </div>
          </div>
          <div className="flex justify-between mb-6">
            <span className="font-display text-lg text-espresso">Total produits</span>
            <div className="text-right font-display text-2xl text-copper">{subtotalLabel}</div>
          </div>
          <Link to="/checkout" className="btn-hero w-full">
            Finaliser la commande <ArrowRight className="w-4 h-4" />
          </Link>
        </aside>
      </div>
    </section>
  );
}
