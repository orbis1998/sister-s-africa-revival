import { Link } from "@tanstack/react-router";
import { formatPrice, type Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      className="group block"
    >
      <div className="relative aspect-square overflow-hidden bg-clay/40 rounded-sm mb-5">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-6 text-center font-display text-2xl text-espresso/40">
            {product.name}
          </div>
        )}
        {product.is_bestseller && (
          <span className="absolute top-4 left-4 bg-espresso text-cream text-[10px] tracking-[0.2em] uppercase px-3 py-1.5">
            Best-seller
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow mb-1">Produit</div>
          <h3 className="font-display text-2xl text-espresso leading-tight">{product.name}</h3>
          {product.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-medium text-espresso">${product.price_usd}</div>
          <div className="text-[11px] text-muted-foreground">{formatPrice(product.price_fcfa, product.price_usd).split(" · ")[0]}</div>
        </div>
      </div>
    </Link>
  );
}
