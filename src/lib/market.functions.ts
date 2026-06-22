import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { normalizeMarketCountry, type MarketCountry } from "@/lib/market";

export const detectVisitorMarket = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const headers = request?.headers;
  const cfCountry = headers?.get("cf-ipcountry")?.toUpperCase();
  if (cfCountry === "CD" || cfCountry === "CG") {
    return { countryCode: cfCountry as MarketCountry, source: "ip" as const };
  }

  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers?.get("x-real-ip")?.trim();
  const ip = forwarded || realIp;
  if (ip && !ip.startsWith("127.") && ip !== "::1") {
    try {
      const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json() as { country_code?: string };
        if (data.country_code === "CD" || data.country_code === "CG") {
          return { countryCode: normalizeMarketCountry(data.country_code), source: "ip" as const };
        }
      }
    } catch {}
  }

  return { countryCode: "CD" as MarketCountry, source: "ip" as const };
});
