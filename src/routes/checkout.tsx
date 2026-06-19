import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { countries, findCountry } from "@/lib/locations";
import { MessageCircle, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createOrder } from "@/lib/orders.functions";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Commande — The Sisters Africa" }] }),
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
  const { items, totalFcfa, totalUsd, clear } = useCart();
  const navigate = useNavigate();
  const placeOrder = useServerFn(createOrder);
  const minDeliveryDate = useMemo(() => tomorrowInputDate(), []);
  const [submitting, setSubmitting] = useState(false);
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
          qty: it.qty, priceUsd: it.priceUsd, priceFcfa: it.priceFcfa,
        })),
        total_fcfa: totalFcfa,
        total_usd: totalUsd,
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
    items.forEach((it) => {
      lines.push(
        `• ${it.qty} × ${it.name} — ${it.variantLabel}  (${(it.priceFcfa * it.qty).toLocaleString("fr-FR")} FCFA / $${it.priceUsd * it.qty})`,
      );
    });
    lines.push("");
    lines.push(`*Total : ${totalFcfa.toLocaleString("fr-FR")} FCFA · $${totalUsd}*`);

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
            {items.map((it) => (
              <div key={`${it.slug}-${it.variantId}`} className="flex justify-between text-sm gap-4">
                <span className="text-espresso/80">{it.qty} × {it.name} <span className="text-muted-foreground">({it.variantLabel})</span></span>
                <span className="text-espresso shrink-0">${it.priceUsd * it.qty}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-baseline mb-6">
            <span className="font-display text-lg text-espresso">Total</span>
            <div className="text-right">
              <div className="font-display text-2xl text-copper">${totalUsd}</div>
              <div className="text-xs text-muted-foreground">{totalFcfa.toLocaleString("fr-FR")} FCFA</div>
            </div>
          </div>
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
