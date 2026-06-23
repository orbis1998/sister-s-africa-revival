import { createFileRoute } from "@tanstack/react-router";
import { StaffShell } from "@/components/admin/AdminLayout";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listOrders, listDrivers, assignOrder, updateOrderStatus, createStaffOrder } from "@/lib/orders.functions";
import { directionFromCity, formatScopedMoney, directionCurrency, formatDeliveryFee } from "@/lib/staff-scope";
import { formatCollectLabel } from "@/lib/seo";
import { countries, findCountry, communeHasZones, communeZones, deliveryLocationLabel } from "@/lib/locations";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageCircle, Phone, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { lookupCommuneDeliveryFee } from "@/lib/delivery.functions";
import { getStaffStockForCity } from "@/lib/stock.functions";
import { formatDeliveryFeeByCountry } from "@/lib/staff-scope";
import { formatVariantLabel } from "@/lib/product-variants";

export const Route = createFileRoute("/_authenticated/admin/logistics")({
  head: () => ({ meta: [{ title: "Logistique — Admin" }] }),
  component: LogisticsPage,
});

const STATUS_OPTIONS: Array<{ value: any; label: string; tone: string }> = [
  { value: "received", label: "Reçue", tone: "bg-stone-200 text-stone-800" },
  { value: "preparing", label: "En préparation", tone: "bg-amber-100 text-amber-900" },
  { value: "ready", label: "Préparée", tone: "bg-blue-100 text-blue-900" },
  { value: "en_route", label: "En route", tone: "bg-orange-100 text-orange-900" },
  { value: "delivered", label: "Livrée", tone: "bg-emerald-100 text-emerald-900" },
  { value: "cancelled", label: "Annulée", tone: "bg-red-100 text-red-900" },
];

function statusMeta(s: string) {
  return STATUS_OPTIONS.find((x) => x.value === s) ?? STATUS_OPTIONS[0];
}

function buildWhatsAppLink(phone: string, message: string) {
  const clean = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

function tomorrowInputDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function deliveryLabel(order: any) {
  if (!order.delivery_date && !order.delivery_time) return "Non précisée";
  const date = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString("fr-FR") : "";
  return [date, order.delivery_time].filter(Boolean).join(" à ");
}

function emptyManualOrder(minDeliveryDate: string) {
  return {
    customer_name: "",
    customer_phone: "",
    country_code: "CD",
    city: "Kinshasa",
    commune: "",
    delivery_zone: "",
    address: "",
    delivery_date: minDeliveryDate,
    delivery_time: "",
    notes: "",
    items: [],
    assigned_to: "",
  };
}

function formatManualOrderSummary(
  products: { usd: number; fcfa: number },
  deliveryFee: number,
  countryCode: string,
) {
  if (countryCode === "CG") {
    const total = products.fcfa + deliveryFee;
    return {
      productsLabel: `${products.fcfa.toLocaleString("fr-FR")} FCFA`,
      deliveryLabel: formatDeliveryFeeByCountry(deliveryFee, countryCode),
      collectLabel: `${total.toLocaleString("fr-FR")} FCFA`,
    };
  }
  return {
    productsLabel: `$${products.usd.toFixed(2)}`,
    deliveryLabel: formatDeliveryFeeByCountry(deliveryFee, countryCode),
    collectLabel: `$${products.usd.toFixed(2)} + ${deliveryFee.toLocaleString("fr-FR")} CDF`,
  };
}

function LogisticsPage() {
  const list = useServerFn(listOrders);
  const drv = useServerFn(listDrivers);
  const assign = useServerFn(assignOrder);
  const upd = useServerFn(updateOrderStatus);
  const createManual = useServerFn(createStaffOrder);
  const lookupFee = useServerFn(lookupCommuneDeliveryFee);
  const staffStockFn = useServerFn(getStaffStockForCity);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [manualOpen, setManualOpen] = useState(false);
  const minDeliveryDate = tomorrowInputDate();
  const [manual, setManual] = useState<any>(() => emptyManualOrder(minDeliveryDate));
  const [manualProduct, setManualProduct] = useState({ product_id: "", variant_id: "", qty: 1 });
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [feeLoading, setFeeLoading] = useState(false);

  const manualCity = useMemo(
    () => findCountry(manual.country_code)?.cities.find((c) => c.name === manual.city),
    [manual.country_code, manual.city],
  );

  const orders = useQuery({ queryKey: ["orders"], queryFn: () => list() });
  const drivers = useQuery({ queryKey: ["drivers"], queryFn: () => drv() });
  const products = useQuery({
    queryKey: ["manual-order-products"],
    queryFn: async () => (await supabase.from("products").select("*").eq("is_active", true).order("name")).data ?? [],
  });
  const variants = useQuery({
    queryKey: ["manual-order-variants"],
    queryFn: async () => (await supabase.from("product_variants").select("*").eq("is_active", true).order("sort_order")).data ?? [],
  });
  const manualStock = useQuery({
    queryKey: ["manual-order-stock", manual.country_code, manual.city],
    enabled: !!manual.city,
    queryFn: () => staffStockFn({ data: { country_code: manual.country_code, city: manual.city } }),
  });
  const selectedProduct = products.data?.find((product: any) => product.id === manualProduct.product_id);
  const productVariants = useMemo(() => {
    if (!selectedProduct) return [];
    const rows = (variants.data ?? []).filter((v: any) => v.product_id === selectedProduct.id);
    if (rows.length) return rows;
    return [{
      id: selectedProduct.id,
      product_id: selectedProduct.id,
      weight_value: 1,
      weight_unit: "kg",
      price_usd: selectedProduct.price_usd,
      price_fcfa: selectedProduct.price_fcfa,
    }];
  }, [selectedProduct, variants.data]);
  const selectedVariant = productVariants.find((v: any) => v.id === manualProduct.variant_id) ?? productVariants[0];
  const stockForVariant = (variantId: string) => Number((manualStock.data as Record<string, number> | undefined)?.[variantId] ?? 0);
  const manualQtyInOrder = (variantId: string) =>
    manual.items
      .filter((item: any) => item.variantId === variantId)
      .reduce((sum: number, item: any) => sum + Number(item.qty ?? 0), 0);
  const selectedAvailable = selectedVariant ? stockForVariant(selectedVariant.id) : 0;
  const selectedRemaining = selectedVariant
    ? Math.max(0, selectedAvailable - manualQtyInOrder(selectedVariant.id))
    : 0;
  const manualTotals = useMemo(() => {
    return manual.items.reduce((sum: { usd: number; fcfa: number }, item: any) => ({
      usd: sum.usd + Number(item.priceUsd ?? 0) * Number(item.qty ?? 1),
      fcfa: sum.fcfa + Number(item.priceFcfa ?? 0) * Number(item.qty ?? 1),
    }), { usd: 0, fcfa: 0 });
  }, [manual.items]);

  const manualSummary = useMemo(
    () => formatManualOrderSummary(manualTotals, deliveryFee, manual.country_code),
    [manualTotals, deliveryFee, manual.country_code],
  );

  const manualZones = communeZones(manualCity, manual.commune);
  const manualNeedsZone = communeHasZones(manualCity, manual.commune);

  useEffect(() => {
    if (!manual.city || !manual.commune) {
      setDeliveryFee(0);
      return;
    }
    if (manualNeedsZone && !manual.delivery_zone) {
      setDeliveryFee(0);
      return;
    }
    let cancelled = false;
    setFeeLoading(true);
    lookupFee({
      data: {
        country_code: manual.country_code,
        city: manual.city,
        commune: manual.commune,
        zone: manual.delivery_zone || undefined,
      },
    })
      .then((fee) => { if (!cancelled) setDeliveryFee(fee.fee_fcfa ?? 0); })
      .catch(() => { if (!cancelled) setDeliveryFee(0); })
      .finally(() => { if (!cancelled) setFeeLoading(false); });
    return () => { cancelled = true; };
  }, [manual.country_code, manual.city, manual.commune, manual.delivery_zone, manualNeedsZone, lookupFee]);

  const assignMut = useMutation({
    mutationFn: (v: { order_id: string; driver_id: string | null }) => assign({ data: v }),
    onSuccess: () => { toast.success("Livreur assigné"); qc.invalidateQueries({ queryKey: ["orders"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const statusMut = useMutation({
    mutationFn: (v: { order_id: string; status: any }) => upd({ data: v }),
    onSuccess: () => { toast.success("Statut mis à jour"); qc.invalidateQueries({ queryKey: ["orders"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const createMut = useMutation({
    mutationFn: (payload: any) => createManual({ data: payload }),
    onSuccess: () => {
      toast.success("Commande créée");
      setManualOpen(false);
      setManual(emptyManualOrder(minDeliveryDate));
      setManualProduct({ product_id: "", variant_id: "", qty: 1 });
      setDeliveryFee(0);
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = (orders.data ?? []).filter((o: any) => filter === "all" ? true : o.status === filter);

  return (
    <StaffShell title="Commandes" requiredRole={["admin", "manager"]} requiredPermission={["can_manage_orders", "can_manage_logistics"]}>
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="eyebrow mb-2">Logistique</div>
          <h1 className="font-display text-4xl text-espresso">Commandes & livraisons</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setManualOpen((v) => !v)} className="inline-flex items-center gap-2 rounded-full bg-espresso px-4 py-2 text-xs font-medium uppercase tracking-widest text-cream">
            <Plus className="h-3.5 w-3.5" /> Commande manuelle
          </button>
          <button onClick={() => setFilter("all")} className={`px-3 py-1.5 text-xs rounded-full border ${filter==="all"?"bg-espresso text-cream border-espresso":"border-border"}`}>Toutes</button>
          {STATUS_OPTIONS.map((s) => (
            <button key={s.value} onClick={() => setFilter(s.value)} className={`px-3 py-1.5 text-xs rounded-full border ${filter===s.value?"bg-espresso text-cream border-espresso":"border-border"}`}>{s.label}</button>
          ))}
        </div>
      </div>

      {manualOpen && (
        <div className="mb-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl">Créer une commande manuelle</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <input placeholder="Nom client" value={manual.customer_name} onChange={(e) => setManual({ ...manual, customer_name: e.target.value })} className="input-admin" />
            <input placeholder="Téléphone client" value={manual.customer_phone} onChange={(e) => setManual({ ...manual, customer_phone: e.target.value })} className="input-admin" />
            <select value={manual.country_code} onChange={(e) => {
              const countryCode = e.target.value;
              const country = findCountry(countryCode) ?? countries[0];
              setManual({ ...manual, country_code: countryCode, city: country.cities[0]?.name ?? "", commune: "", delivery_zone: "" });
            }} className="input-admin">
              {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
            </select>
            <select value={manual.city} onChange={(e) => setManual({ ...manual, city: e.target.value, commune: "", delivery_zone: "" })} className="input-admin">
              <option value="">Sélectionner une ville…</option>
              {(findCountry(manual.country_code)?.cities ?? []).map((city) => <option key={city.name} value={city.name}>{city.name}</option>)}
            </select>
            <select
              value={manual.commune}
              onChange={(e) => setManual({ ...manual, commune: e.target.value, delivery_zone: "" })}
              disabled={!manualCity}
              className="input-admin"
            >
              <option value="">{manualCity ? "Sélectionner une commune…" : "Choisissez d'abord la ville"}</option>
              {manualCity?.communes.map((commune) => (
                <option key={commune.name} value={commune.name}>{commune.name}</option>
              ))}
            </select>
            {manualNeedsZone && (
              <select
                value={manual.delivery_zone}
                onChange={(e) => setManual({ ...manual, delivery_zone: e.target.value })}
                className="input-admin"
              >
                <option value="">Sélectionner un quartier / zone…</option>
                {manualZones.map((zone) => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
            )}
            <input placeholder="Adresse précise" value={manual.address} onChange={(e) => setManual({ ...manual, address: e.target.value })} className="input-admin" />
            <input type="date" min={minDeliveryDate} value={manual.delivery_date} onChange={(e) => setManual({ ...manual, delivery_date: e.target.value })} className="input-admin" />
            <input type="time" value={manual.delivery_time} onChange={(e) => setManual({ ...manual, delivery_time: e.target.value })} className="input-admin" />
            <select value={manual.assigned_to} onChange={(e) => setManual({ ...manual, assigned_to: e.target.value })} className="input-admin">
              <option value="">Assigner plus tard</option>
              {(drivers.data ?? [])
                .filter((driver: any) => driver.city_scope === directionFromCity(manual.city, manual.country_code))
                .map((driver: any) => <option key={driver.id} value={driver.id}>{driver.full_name ?? "Livreur"}{driver.badge_id ? ` (${driver.badge_id})` : ""}</option>)}
            </select>
            <textarea placeholder="Notes" value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} className="input-admin resize-none md:col-span-3" rows={3} />
          </div>
          <div className="mt-5 rounded-2xl border border-border bg-cream/60 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_100px_auto]">
              <select value={manualProduct.product_id} onChange={(e) => setManualProduct({ product_id: e.target.value, variant_id: "", qty: manualProduct.qty })} className="input-admin">
                <option value="">Sélectionner un produit</option>
                {(products.data ?? []).map((product: any) => {
                  const productVariantRows = (variants.data ?? []).filter((v: any) => v.product_id === product.id);
                  const variantIds = productVariantRows.length
                    ? productVariantRows.map((v: any) => v.id)
                    : [product.id];
                  const avail = variantIds.reduce((sum: number, id: string) => sum + stockForVariant(id), 0);
                  return (
                    <option key={product.id} value={product.id} disabled={avail <= 0}>
                      {product.name}{avail <= 0 ? " — Fini en stock" : ` (${avail} dispo)`}
                    </option>
                  );
                })}
              </select>
              {selectedProduct && productVariants.length > 0 && (
                <select
                  value={manualProduct.variant_id || selectedVariant?.id || ""}
                  onChange={(e) => setManualProduct({ ...manualProduct, variant_id: e.target.value })}
                  className="input-admin"
                >
                  {productVariants.map((v: any) => {
                    const avail = stockForVariant(v.id);
                    return (
                      <option key={v.id} value={v.id} disabled={avail <= 0}>
                        {formatVariantLabel(Number(v.weight_value), v.weight_unit)}
                        {avail <= 0 ? " — Fini en stock" : ` (${avail} dispo)`}
                        {" · "}
                        {manual.country_code === "CG"
                          ? `${Number(v.price_fcfa).toLocaleString("fr-FR")} FCFA`
                          : `$${v.price_usd}`}
                      </option>
                    );
                  })}
                </select>
              )}
              <input type="number" min={1} max={Math.max(1, selectedRemaining || 1)} value={manualProduct.qty} onChange={(e) => setManualProduct({ ...manualProduct, qty: Number.parseInt(e.target.value || "1", 10) })} className="input-admin" />
              <button
                type="button"
                className="rounded bg-espresso px-4 py-2 text-xs font-medium uppercase tracking-widest text-cream disabled:opacity-50"
                disabled={!selectedProduct || !selectedVariant || selectedRemaining <= 0}
                onClick={() => {
                  if (!selectedProduct || !selectedVariant) return;
                  if (selectedRemaining <= 0) {
                    toast.error(`${selectedProduct.name} — fini en stock`);
                    return;
                  }
                  const qty = Math.max(1, Math.min(selectedRemaining, manualProduct.qty || 1));
                  const label = formatVariantLabel(Number(selectedVariant.weight_value), selectedVariant.weight_unit);
                  const item = {
                    slug: selectedProduct.slug,
                    name: selectedProduct.name,
                    variantId: selectedVariant.id,
                    variantLabel: label,
                    qty,
                    priceUsd: Number(selectedVariant.price_usd ?? 0),
                    priceFcfa: Number(selectedVariant.price_fcfa ?? 0),
                  };
                  const existingIndex = manual.items.findIndex((current: any) => current.variantId === item.variantId);
                  const nextItems = existingIndex >= 0
                    ? manual.items.map((current: any, index: number) => index === existingIndex ? { ...current, qty: current.qty + item.qty } : current)
                    : [...manual.items, item];
                  setManual({ ...manual, items: nextItems });
                  setManualProduct({ product_id: "", variant_id: "", qty: 1 });
                }}
              >
                Ajouter
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {manual.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun produit ajouté à la commande.</p>
              ) : manual.items.map((item: any) => (
                <div key={item.variantId} className="flex items-center justify-between gap-3 rounded-xl bg-card p-3 text-sm">
                  <div>
                    <strong>{item.qty} × {item.name}{item.variantLabel ? ` (${item.variantLabel})` : ""}</strong>
                    <div className="text-xs text-muted-foreground">
                      {manual.country_code === "CG"
                        ? `${(item.priceFcfa * item.qty).toLocaleString("fr-FR")} FCFA`
                        : `$${(item.priceUsd * item.qty).toFixed(2)}`}
                    </div>
                  </div>
                  <button type="button" onClick={() => setManual({ ...manual, items: manual.items.filter((current: any) => current.variantId !== item.variantId) })} className="rounded-full p-2 text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-clay p-4 text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Produits</span>
                <strong>{manualSummary.productsLabel}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Livraison{manual.commune ? ` (${deliveryLocationLabel(manual.commune, manual.delivery_zone)})` : ""}
                </span>
                <strong>{feeLoading ? "Calcul…" : manualSummary.deliveryLabel}</strong>
              </div>
              <div className="flex justify-between gap-4 border-t border-espresso/10 pt-2">
                <span className="text-espresso">Total à encaisser</span>
                <strong className="text-copper">{manualSummary.collectLabel}</strong>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setManualOpen(false)}>Annuler</button>
            <button
              className="btn-hero"
              disabled={createMut.isPending || manual.items.length === 0 || !manual.commune || !manual.city || !manual.customer_name.trim() || (manualNeedsZone && !manual.delivery_zone)}
              onClick={() => {
                const country = findCountry(manual.country_code)!;
                createMut.mutate({
                  ...manual,
                  country_name: country.name,
                  total_usd: manualTotals.usd,
                  total_fcfa: manualTotals.fcfa,
                  delivery_fee_fcfa: deliveryFee,
                  delivery_fee_usd: 0,
                  assigned_to: manual.assigned_to || null,
                });
              }}
            >
              {createMut.isPending ? "Création..." : "Créer la commande"}
            </button>
          </div>
        </div>
      )}

      {orders.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded p-12 text-center text-muted-foreground">Aucune commande pour ce filtre.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((o: any) => {
            const meta = statusMeta(o.status);
            const itemsTxt = (o.items as any[]).map((it) => `• ${it.qty} × ${it.name} (${it.variantLabel})`).join("\n");
            const productsLabel = formatScopedMoney(o, o.city_scope);
            const deliveryLabelMoney = formatDeliveryFee(o.delivery_fee_fcfa ?? 0, o.city_scope);
            const collectLabel = formatCollectLabel(o, directionCurrency(o.city_scope) as "FCFA" | "USD");
            const customerMsg = `Bonjour ${o.customer_name}, votre commande *${o.order_number}* chez The Sisters est maintenant *${meta.label.toLowerCase()}*.\n\n${itemsTxt}\n\nProduits : ${productsLabel}\nLivraison : ${deliveryLabelMoney}\nTotal : ${collectLabel}`;
            const driverMsg = o.driver ? `Bonjour ${o.driver.full_name ?? ""}, nouvelle livraison à effectuer :\n\nCommande : *${o.order_number}*\nClient : ${o.customer_name} (${o.customer_phone})\nAdresse : ${o.address}, ${o.commune}, ${o.city}\nLivraison : ${deliveryLabel(o)}\n${o.notes ? "Notes : " + o.notes + "\n" : ""}\nArticles :\n${itemsTxt}\n\nSolde produits : ${productsLabel}\nFrais livraison : ${deliveryLabelMoney}\nTotal à encaisser : ${collectLabel}` : "";
            return (
              <div key={o.id} className="bg-card border border-border rounded p-5">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-display text-xl text-espresso">{o.order_number}</span>
                      <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${meta.tone}`}>{meta.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("fr-FR")}</div>
                    <div className="mt-1 text-xs text-copper">Livraison : {deliveryLabel(o)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Solde produits</div>
                    <div className="font-display text-2xl text-copper">{productsLabel}</div>
                    {(o.delivery_fee_fcfa || o.delivery_fee_usd) ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        + livraison {deliveryLabelMoney} · encaisser {collectLabel}
                      </div>
                    ) : null}
                    <div className="text-xs text-muted-foreground">{o.city}</div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 text-sm mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Client</div>
                    <div className="text-espresso">{o.customer_name}</div>
                    <div className="text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{o.customer_phone}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Livraison</div>
                    <div className="text-espresso flex items-start gap-1"><MapPin className="w-3 h-3 mt-1 shrink-0" /><span>{o.address}<br/>{deliveryLocationLabel(o.commune, o.delivery_zone)}, {o.city} — {o.country_name}</span></div>
                    <div className="mt-1 text-xs text-muted-foreground">{deliveryLabel(o)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Articles</div>
                    <ul className="text-espresso/80 space-y-0.5">
                      {(o.items as any[]).map((it, i) => (
                        <li key={i}>{it.qty} × {it.name} <span className="text-muted-foreground">({it.variantLabel})</span></li>
                      ))}
                    </ul>
                  </div>
                </div>

                {o.notes && <div className="text-xs bg-cream/60 border border-border rounded p-2 mb-4"><strong>Notes :</strong> {o.notes}</div>}

                <div className="grid md:grid-cols-3 gap-3 pt-4 border-t border-border">
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Livreur</span>
                    <select
                      value={o.assigned_to ?? ""}
                      onChange={(e) => assignMut.mutate({ order_id: o.id, driver_id: e.target.value || null })}
                      className="w-full bg-cream border border-input rounded px-3 py-2 text-sm"
                    >
                      <option value="">— Non assigné —</option>
                      {(drivers.data ?? []).map((d: any) => (
                        <option key={d.id} value={d.id}>{d.full_name ?? "Sans nom"}{d.badge_id ? ` (${d.badge_id})` : ""}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Statut</span>
                    <select
                      value={o.status}
                      onChange={(e) => statusMut.mutate({ order_id: o.id, status: e.target.value })}
                      className="w-full bg-cream border border-input rounded px-3 py-2 text-sm"
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-col gap-2 justify-end">
                    <a
                      href={buildWhatsAppLink(o.customer_phone, customerMsg)}
                      target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-2 bg-[#25D366] text-white text-xs font-medium px-3 py-2 rounded hover:opacity-90"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Notifier le client
                    </a>
                    {o.driver?.phone && (
                      <a
                        href={buildWhatsAppLink(o.driver.phone, driverMsg)}
                        target="_blank" rel="noreferrer"
                        className="flex items-center justify-center gap-2 bg-espresso text-cream text-xs font-medium px-3 py-2 rounded hover:opacity-90"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Notifier le livreur
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StaffShell>
  );
}
