import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  loadStoredMarket,
  saveStoredMarket,
  type MarketCountry,
  type MarketState,
} from "@/lib/market";
import { detectVisitorMarket } from "@/lib/market.functions";

type MarketContextValue = MarketState & {
  setCountry: (code: MarketCountry, source?: MarketState["source"]) => void;
  ready: boolean;
};

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const detectFn = useServerFn(detectVisitorMarket);
  const [state, setState] = useState<MarketState>(() => loadStoredMarket() ?? { countryCode: "CD", source: "ip" });
  const [ready, setReady] = useState(!!loadStoredMarket());

  useEffect(() => {
    if (loadStoredMarket()) {
      setReady(true);
      return;
    }
    detectFn({})
      .then((result) => {
        const next = { countryCode: result.countryCode, source: result.source };
        setState(next);
        saveStoredMarket(next);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [detectFn]);

  const setCountry = (countryCode: MarketCountry, source: MarketState["source"] = "manual") => {
    const next = { countryCode, source };
    setState(next);
    saveStoredMarket(next);
  };

  const value = useMemo(() => ({ ...state, setCountry, ready }), [state, ready]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used within MarketProvider");
  return ctx;
}
