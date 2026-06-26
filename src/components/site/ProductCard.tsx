import { Link } from "@tanstack/react-router";
import { formatProductPriceRange, type PriceLike } from "@/lib/market";
import { useMarket } from "@/lib/market-context";
import { useMarketStock } from "@/lib/use-market-stock";
import { productDisplayPrices, type ProductWithVariants } from "@/lib/products";

export function ProductCard({ product }: { product: ProductWithVariants }) {
  const { countryCode } = useMarket();
  const { productInStock, isLoading } = useMarketStock();
  const variantIds = product.variants.map((v) => v.id);
  const outOfStock = !isLoading && !productInStock(variantIds);
  const activeVariants = product.variants.filter((v) => v.is_active);
  const prices = productDisplayPrices(product);
  const priceVariants: PriceLike[] = activeVariants.length
    ? activeVariants.map((v) => ({
        price_usd: v.price_usd,
        price_fcfa: v.price_fcfa,
        price_cdf: v.price_cdf ?? 0,
        rdc_price_currency: v.rdc_price_currency ?? "usd",
      }))
    : [{
        price_usd: prices.price_usd,
        price_fcfa: prices.price_fcfa,
        price_cdf: (product as any).price_cdf ?? 0,
        rdc_price_currency: (product as any).rdc_price_currency ?? "usd",
      }];

  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      className={`group block ${outOfStock ? "opacity-90" : ""}`}
    >
      <div className="relative aspect-square overflow-hidden bg-clay/40 rounded-sm mb-5">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className={`w-full h-full object-cover transition-transform duration-700 ${outOfStock ? "grayscale-[35%]" : "group-hover:scale-105"}`}
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
        {outOfStock && (
          <span className="absolute bottom-4 left-4 right-4 bg-destructive/95 text-cream text-center text-[10px] tracking-[0.18em] uppercase px-3 py-2">
            Fini en stock
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
          <div className="text-sm font-medium text-copper">{formatProductPriceRange(priceVariants, countryCode)}</div>
        </div>
      </div>
    </Link>
  );
}
