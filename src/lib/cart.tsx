import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { RdcPriceCurrency } from "@/lib/market";

export interface CartItem {
  slug: string;
  name: string;
  variantId: string;
  variantLabel: string;
  priceUsd: number;
  priceFcfa: number;
  priceCdf: number;
  rdcCurrency: RdcPriceCurrency;
  image: string;
  qty: number;
}

interface CartContextValue {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  remove: (slug: string, variantId: string) => void;
  setQty: (slug: string, variantId: string, qty: number) => void;
  clear: () => void;
  totalFcfa: number;
  totalUsd: number;
  totalCdf: number;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "ts-cart-v2";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    setItems((prev) => {
      const i = prev.findIndex((p) => p.slug === item.slug && p.variantId === item.variantId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + qty };
        return next;
      }
      return [...prev, { ...item, qty }];
    });
  }, []);

  const remove = useCallback((slug: string, variantId: string) => {
    setItems((prev) => prev.filter((p) => !(p.slug === slug && p.variantId === variantId)));
  }, []);

  const setQty = useCallback((slug: string, variantId: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((p) => (p.slug === slug && p.variantId === variantId ? { ...p, qty: Math.max(1, qty) } : p))
        .filter((p) => p.qty > 0),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const totalFcfa = items.reduce((s, i) => s + i.priceFcfa * i.qty, 0);
    const totalUsd = items.reduce((s, i) => s + (i.rdcCurrency === "usd" ? i.priceUsd * i.qty : 0), 0);
    const totalCdf = items.reduce((s, i) => s + (i.rdcCurrency === "cdf" ? i.priceCdf * i.qty : 0), 0);
    const count = items.reduce((s, i) => s + i.qty, 0);
    return { items, add, remove, setQty, clear, totalFcfa, totalUsd, totalCdf, count };
  }, [items, add, remove, setQty, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
