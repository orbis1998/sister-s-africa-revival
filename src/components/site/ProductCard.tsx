import { Link } from "@tanstack/react-router";
import type { Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const v = product.variants[0];
  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      className="group block"
    >
      <div className="relative aspect-square overflow-hidden bg-clay/40 rounded-sm mb-5">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        {product.bestSeller && (
          <span className="absolute top-4 left-4 bg-espresso text-cream text-[10px] tracking-[0.2em] uppercase px-3 py-1.5">
            Best-seller
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow mb-1">{product.category}</div>
          <h3 className="font-display text-2xl text-espresso leading-tight">{product.name}</h3>
          <p className="text-xs text-muted-foreground mt-1">{product.tagline}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-medium text-espresso">${v.priceUsd}</div>
          <div className="text-[11px] text-muted-foreground">{v.priceFcfa.toLocaleString("fr-FR")} FCFA</div>
        </div>
      </div>
    </Link>
  );
}
