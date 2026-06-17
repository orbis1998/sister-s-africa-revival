import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getProduct } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { Reviews } from "@/components/site/Reviews";
import { ReviewForm } from "@/components/site/ReviewForm";
import { Check, ShoppingBag, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/product/$slug")({
  head: ({ params }) => {
    const p = getProduct(params.slug);
    return {
      meta: [
        { title: p ? `${p.name} — The Sisters Africa` : "Produit — The Sisters Africa" },
        { name: "description", content: p?.description.slice(0, 160) ?? "" },
        { property: "og:title", content: p?.name ?? "Produit" },
        { property: "og:description", content: p?.description.slice(0, 160) ?? "" },
        ...(p ? [{ property: "og:image" as const, content: p.image }] : []),
      ],
    };
  },
  loader: ({ params }) => {
    const product = getProduct(params.slug);
    if (!product) throw notFound();
    return { product };
  },
  notFoundComponent: () => (
    <div className="container-page py-32 text-center">
      <h1 className="font-display text-4xl text-espresso mb-4">Produit introuvable</h1>
      <Link to="/products" className="btn-hero mt-4">Retour à la boutique</Link>
    </div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const { add } = useCart();
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [qty, setQty] = useState(1);
  const [refresh, setRefresh] = useState(0);

  const variant = product.variants.find((v) => v.id === variantId)!;

  function addToCart() {
    add(
      {
        slug: product.slug,
        name: product.name,
        variantId: variant.id,
        variantLabel: variant.label,
        priceFcfa: variant.priceFcfa,
        priceUsd: variant.priceUsd,
        image: product.image,
      },
      qty,
    );
    toast.success(`${product.name} ajouté au panier`);
  }

  return (
    <>
      <div className="container-page pt-8">
        <Link to="/products" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-copper">
          <ArrowLeft className="w-3.5 h-3.5" /> Boutique
        </Link>
      </div>

      <section className="container-page py-12 grid lg:grid-cols-2 gap-16">
        <div className="bg-clay/40 aspect-square rounded-sm overflow-hidden">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" width={1024} height={1024} />
        </div>

        <div>
          <div className="eyebrow mb-3">{product.category}</div>
          <h1 className="font-display text-5xl text-espresso mb-3">{product.name}</h1>
          <p className="text-muted-foreground mb-8">{product.tagline}</p>

          <div className="flex items-baseline gap-3 mb-8">
            <span className="font-display text-4xl text-copper">${variant.priceUsd}</span>
            <span className="text-sm text-muted-foreground">· {variant.priceFcfa.toLocaleString("fr-FR")} FCFA</span>
          </div>

          <p className="text-espresso/80 leading-relaxed mb-8">{product.description}</p>

          {product.variants.length > 1 && (
            <div className="mb-6">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Format</div>
              <div className="grid grid-cols-2 gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVariantId(v.id)}
                    className={`p-4 text-left rounded-sm border transition-colors ${
                      v.id === variantId
                        ? "border-copper bg-copper/5"
                        : "border-border hover:border-espresso/40"
                    }`}
                  >
                    <div className="text-sm font-medium text-espresso">{v.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">${v.priceUsd} · {v.priceFcfa.toLocaleString("fr-FR")} FCFA</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center border border-border rounded-sm">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-4 py-3 text-espresso hover:text-copper">−</button>
              <span className="px-4 text-sm w-10 text-center">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="px-4 py-3 text-espresso hover:text-copper">+</button>
            </div>
            <button onClick={addToCart} className="btn-hero flex-1">
              <ShoppingBag className="w-4 h-4" /> Ajouter au panier
            </button>
          </div>

          <div className="border-t border-border pt-6 mb-6">
            <div className="eyebrow mb-3">Bénéfices</div>
            <ul className="space-y-2">
              {product.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-espresso/80">
                  <Check className="w-4 h-4 text-copper mt-0.5 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {product.composition && (
            <div className="border-t border-border pt-6 mb-6">
              <div className="eyebrow mb-3">Composition</div>
              <p className="text-sm text-espresso/80">{product.composition.join(" · ")}</p>
            </div>
          )}

          {product.warning && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-sm p-4 flex gap-3">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-espresso/80">{product.warning}</p>
            </div>
          )}
        </div>
      </section>

      <section className="container-page py-20 border-t border-border/60">
        <Reviews productSlug={product.slug} refreshKey={refresh} />
        <div className="mt-12 max-w-2xl mx-auto">
          <ReviewForm productSlug={product.slug} onSubmitted={() => setRefresh((r) => r + 1)} />
        </div>
      </section>
    </>
  );
}
