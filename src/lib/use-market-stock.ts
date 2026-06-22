import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMarket } from "@/lib/market-context";
import { getPublicStockForMarket, isInStock, type StockMap } from "@/lib/stock.functions";

export function useMarketStock() {
  const { countryCode, ready } = useMarket();
  const fn = useServerFn(getPublicStockForMarket);
  const query = useQuery({
    queryKey: ["market-stock", countryCode],
    enabled: ready,
    queryFn: () => fn({ data: { countryCode } }) as Promise<StockMap>,
    staleTime: 30_000,
  });

  function availableForVariant(variantId: string) {
    return query.data?.[variantId] ?? 0;
  }

  function availableForProduct(variantIds: string[]) {
    if (!variantIds.length) return 0;
    return variantIds.reduce((sum, id) => sum + (query.data?.[id] ?? 0), 0);
  }

  function productInStock(variantIds: string[]) {
    return variantIds.some((id) => isInStock(query.data?.[id]));
  }

  return {
    ...query,
    availableForVariant,
    availableForProduct,
    productInStock,
    /** @deprecated use availableForVariant or availableForProduct */
    availableFor: (id: string) => query.data?.[id] ?? 0,
    isAvailable: (variantId: string) => isInStock(query.data?.[variantId]),
  };
}
