import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { countries, findCountry } from "@/lib/locations";
import { formatDeliveryFeeByCountry } from "@/lib/staff-scope";
import { formatCheckoutCollect, formatLineTotal, productUnitPrice, type MarketCountry } from "@/lib/market";
import { useMarket } from "@/lib/market-context";
import { MessageCircle, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createOrder } from "@/lib/orders.functions";
import { lookupCommuneDeliveryFee } from "@/lib/delivery.functions";
import { buildSeoMeta } from "@/lib/seo";

export const Route = createFileRoute("/checkout")({
  head: () => buildSeoMeta({
    title: "Commande — The Sisters Africa",
    description: "Finalisez votre commande et recevez vos bouillies bio The Sisters Africa à domicile.",
    url: "https://thesistersafrica.com/checkout",
  }),
  component: CheckoutPage,
});

const schema = z.object({
  fullName: z.string().trim().min(2, "Nom requis").max(120),
  phone: z.string().trim().min(7, "Téléphone requis").max(30),
  countryCode: z.enum(["CD", "CG"]),
  city: z.string().min(1, "Ville requise"),
  commune: z.string().min(1, "Commune requise"),
  address: z.string().trim().min(3, "Adresse requise").max(300),
  deliveryDate: z.string().min(1, "Jour de livraison requis"),
  deliveryTime: z.string().min(1, "Heure de livraison requise"),
  notes: z.string().trim().max(500).optional(),
});

function tomorrowInputDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function CheckoutPage() {
  const { items, totalFcfa, totalUsd, totalCdf, clear } = useCart();
  const { countryCode: marketCountry, setCountry: setMarketCountry, ready: marketReady } = useMarket();
  const navigate = useNavigate();
  const placeOrder = useServerFn(createOrder);
  const lookupFee = useServerFn(lookupCommuneDeliveryFee);
  const minDeliveryDate = useMemo(() => tomorrowInputDate(), []);
  const [submitting, setSubmitting] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState({ fee_fcfa: 0, fee_usd: 0 });
  const [feeLoading, setFeeLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    countryCode: "CD" as "CD" | "CG",
    city: "",
    commune: "",
    address: "",
    deliveryDate: minDeliveryDate,
    deliveryTime: "",
    notes: "",
  });

  const country = useMemo(() => findCountry(form.countryCode)!, [form.countryCode]);
  const market = form.countryCode as MarketCountry;
  const pricingItems = items.map((it) => ({
    ...it,
    price_usd: it.priceUsd,
    price_fcfa: it.priceFcfa,
    price_cdf: it.priceCdf,
    rdc_price_currency: it.rdcCurrency,
    variantLabel: it.variantLabel,
  }));
  const collect = formatCheckoutCollect(pricingItems, market, deliveryFee.fee_fcfa);

  const marketSynced = useRef(false);

  useEffect(() => {
    setMarketCountry(form.countryCode, "checkout");
  }, [form.countryCode, setMarketCountry]);

  useEffect(() => {
    if (!marketReady || marketSynced.current) return;
    marketSynced.current = true;
    setForm((f) => ({ ...f, countryCode: marketCountry }));
  }, [marketReady, marketCountry]);

  useEffect(() => {
    if (!form.city || !form.commune) {
      setDeliveryFee({ fee_fcfa: 0, fee_usd: 0 });
      return;
    }
    let cancelled = false;
    setFeeLoading(true);
    lookupFee({ data: { country_code: form.countryCode, city: form.city, commune: form.commune } })
      .then((fee) => { if (!cancelled) setDeliveryFee(fee); })
      .catch(() => { if (!cancelled) setDeliveryFee({ fee_fcfa: 0, fee_usd: 0 }); })
      .finally(() => { if (!cancelled) setFeeLoading(false); });
    return () => { cancelled = true; };
  }, [form.countryCode, form.city, form.commune, lookupFee]);

  const cityObj = country.cities.find((c) => c.name === form.city);

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Votre panier est vide");
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (parsed.data.deliveryDate < minDeliveryDate) {
      toast.error("La livraison ne peut pas être programmée le jour même. Choisissez demain ou plus tard.");
      return;
    }
    setSubmitting(true);

    let orderNumber = "";
    try {
      const res = await placeOrder({ data: {
        customer_name: parsed.data.fullName,
        customer_phone: parsed.data.phone,
        country_code: country.code,
        country_name: country.name,
        city: parsed.data.city,
        commune: parsed.data.commune,
        address: parsed.data.address,
        delivery_date: parsed.data.deliveryDate,
        delivery_time: parsed.data.deliveryTime,
        notes: parsed.data.notes,
        items: items.map((it) => ({
          slug: it.slug, name: it.name, variantId: it.variantId, variantLabel: it.variantLabel,
          qty: it.qty, priceUsd: it.priceUsd, priceFcfa: it.priceFcfa, priceCdf: it.priceCdf, rdcCurrency: it.rdcCurrency,
        })),
        total_fcfa: market === "CG" ? totalFcfa : totalCdf,
        total_usd: totalUsd,
        delivery_fee_fcfa: deliveryFee.fee_fcfa,
        delivery_fee_usd: deliveryFee.fee_usd,
      } });
      orderNumber = (res as any)?.order_number ?? "";
    } catch (err: any) {
      toast.error("Enregistrement impossible : " + (err?.message ?? "erreur"));
      setSubmitting(false);
      return;
    }

    const lines: string[] = [];
    lines.push("*Nouvelle commande — The Sisters*");
    if (orderNumber) lines.push(`N° : ${orderNumber}`);
    lines.push("");
    lines.push("*Client*");
    lines.push(`• Nom : ${parsed.data.fullName}`);
    lines.push(`• Téléphone : ${parsed.data.phone}`);
    lines.push(`• Pays : ${country.name}`);
    lines.push(`• Ville : ${parsed.data.city}`);
    lines.push(`• Commune : ${parsed.data.commune}`);
    lines.push(`• Adresse : ${parsed.data.address}`);
    lines.push(`• Livraison : ${new Date(parsed.data.deliveryDate).toLocaleDateString("fr-FR")} à ${parsed.data.deliveryTime}`);
    if (parsed.data.notes) lines.push(`• Notes : ${parsed.data.notes}`);
    lines.push("");
    lines.push("*Articles*");
    collect.whatsappProductsLines.forEach((line) => lines.push(line));
    lines.push("");
    lines.push(collect.whatsappSubtotal);
    if (collect.whatsappDelivery) lines.push(collect.whatsappDelivery);
    lines.push(collect.whatsappTotal);

    const message = encodeURIComponent(lines.join("\n"));
    const whatsappNumber = cityObj?.whatsapp ?? country.whatsapp;
    const url = `https://wa.me/${whatsappNumber}?text=${message}`;

    toast.success("Commande enregistrée — redirection WhatsApp…");
    setTimeout(() => {
      window.open(url, "_blank");
      clear();
      navigate({ to: "/" });
    }, 600);
  }

  return (
    <section className="container-page py-16">
      <div className="eyebrow mb-3">Commande</div>
      <h1 className="font-display text-5xl text-espresso mb-12">Finalisation</h1>

      <form onSubmit={onSubmit} className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <Section title="Coordonnées">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nom complet">
                <input
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  required
                  maxLength={120}
                  className="input"
                />
              </Field>
              <Field label="Téléphone (WhatsApp de préférence)">
                <input
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  required
                  maxLength={30}
                  placeholder="+243…"
                  className="input"
                />
              </Field>
            </div>
          </Section>

          <Section title="Livraison">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Pays">
                <select
                  value={form.countryCode}
                  onChange={(e) => {
                    update("countryCode", e.target.value as "CD" | "CG");
                    update("city", "");
                    update("commune", "");
                  }}
                  className="input"
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Ville">
                <select
                  value={form.city}
                  onChange={(e) => { update("city", e.target.value); update("commune", ""); }}
                  required
                  className="input"
                >
                  <option value="">Sélectionner…</option>
                  {country.cities.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Commune / Quartier">
                <select
                  value={form.commune}
                  onChange={(e) => update("commune", e.target.value)}
                  required
                  disabled={!cityObj}
                  className="input"
                >
                  <option value="">{cityObj ? "Sélectionner…" : "Choisissez d'abord la ville"}</option>
                  {cityObj?.communes.map((cm) => (
                    <option key={cm} value={cm}>{cm}</option>
                  ))}
                </select>
                {form.commune && (
                  <span className="mt-1 block text-[11px] text-copper">
                    {feeLoading
                      ? "Calcul des frais de livraison…"
                      : `Livraison : ${formatDeliveryFeeByCountry(deliveryFee.fee_fcfa, form.countryCode)}`}
                  </span>
                )}
              </Field>
              <Field label="Adresse précise">
                <input
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  required
                  maxLength={300}
                  placeholder="Avenue, n°, point de repère…"
                  className="input"
                />
              </Field>
              <Field label="Jour de livraison">
                <input
                  type="date"
                  min={minDeliveryDate}
                  value={form.deliveryDate}
                  onChange={(e) => update("deliveryDate", e.target.value)}
                  required
                  className="input"
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">Livraison à partir de demain uniquement.</span>
              </Field>
              <Field label="Heure souhaitée">
                <input
                  type="time"
                  value={form.deliveryTime}
                  onChange={(e) => update("deliveryTime", e.target.value)}
                  required
                  className="input"
                />
              </Field>
            </div>
            <Field label="Notes pour la livraison (optionnel)">
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                maxLength={500}
                rows={3}
                className="input resize-none"
              />
            </Field>
          </Section>
        </div>

        <aside className="bg-card border border-border rounded-sm p-8 h-fit lg:sticky lg:top-28">
          <h2 className="font-display text-xl text-espresso mb-6">Récapitulatif</h2>
          <div className="space-y-3 mb-6 pb-6 border-b border-border max-h-64 overflow-auto">
            {items.map((it) => {
              const unit = pricingItems.find((p) => p.slug === it.slug && p.variantId === it.variantId)!;
              const { amount, label } = productUnitPrice(unit, market);
              return (
                <div key={`${it.slug}-${it.variantId}`} className="flex justify-between text-sm gap-4">
                  <span className="text-espresso/80">{it.qty} × {it.name} <span className="text-muted-foreground">({it.variantLabel})</span></span>
                  <span className="text-espresso shrink-0">{formatLineTotal(amount, label, it.qty)}</span>
                </div>
              );
            })}
          </div>
          <div className="space-y-2 mb-6 pb-6 border-b border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sous-total produits</span>
              <span>{collect.productsLabel}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Frais livraison{form.commune ? ` (${form.commune})` : ""}</span>
              <span>{feeLoading ? "…" : collect.deliveryLabel}</span>
            </div>
          </div>
          <div className="flex justify-between items-baseline mb-6">
            <span className="font-display text-lg text-espresso">Total à payer</span>
            <div className="text-right font-display text-2xl text-copper">{collect.totalLabel}</div>
          </div>
          <p className="mb-4 text-[11px] text-muted-foreground">
            {market === "CD"
              ? "RDC : produits en USD ou CDF selon l'article, livraison en CDF. Pas de conversion automatique."
              : "Congo : produits et livraison en FCFA."}
          </p>
          <button type="submit" disabled={submitting || items.length === 0} className="btn-hero w-full disabled:opacity-50">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirection…</> : <><MessageCircle className="w-4 h-4" /> Commander par WhatsApp</>}
          </button>
          <p className="text-[11px] text-muted-foreground text-center mt-4">
            Vous serez mis(e) en relation avec notre équipe via <strong>{cityObj?.whatsappDisplay ?? country.whatsappDisplay}</strong> pour confirmer et payer à la livraison.
          </p>
        </aside>
      </form>

      <style>{`
        .input {
          width: 100%;
          background: var(--cream);
          border: 1px solid var(--input);
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          border-radius: 2px;
          color: var(--espresso);
          transition: border-color 0.2s;
        }
        .input:focus { outline: none; border-color: var(--copper); }
      `}</style>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="eyebrow mb-5">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">{label}</span>
      {children}
    </label>
  );
}
