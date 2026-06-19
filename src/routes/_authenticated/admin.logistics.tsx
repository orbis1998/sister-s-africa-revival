import { createFileRoute } from "@tanstack/react-router";
import { StaffShell } from "@/components/admin/AdminLayout";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listOrders, listDrivers, assignOrder, updateOrderStatus, createStaffOrder } from "@/lib/orders.functions";
import { directionFromCity, formatScopedMoney } from "@/lib/staff-scope";
import { countries, findCountry } from "@/lib/locations";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageCircle, Phone, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

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
    address: "",
    delivery_date: minDeliveryDate,
    delivery_time: "",
    notes: "",
    items: [],
    assigned_to: "",
  };
}

function LogisticsPage() {
  const list = useServerFn(listOrders);
  const drv = useServerFn(listDrivers);
  const assign = useServerFn(assignOrder);
  const upd = useServerFn(updateOrderStatus);
  const createManual = useServerFn(createStaffOrder);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [manualOpen, setManualOpen] = useState(false);
  const minDeliveryDate = tomorrowInputDate();
  const [manual, setManual] = useState<any>(() => emptyManualOrder(minDeliveryDate));
  const [manualProduct, setManualProduct] = useState({ product_id: "", qty: 1 });

  const orders = useQuery({ queryKey: ["orders"], queryFn: () => list() });
  const drivers = useQuery({ queryKey: ["drivers"], queryFn: () => drv() });
  const products = useQuery({
    queryKey: ["manual-order-products"],
    queryFn: async () => (await supabase.from("products").select("*").eq("is_active", true).order("name")).data ?? [],
  });
  const selectedProduct = products.data?.find((product: any) => product.id === manualProduct.product_id);
  const manualTotals = useMemo(() => {
    return manual.items.reduce((sum: { usd: number; fcfa: number }, item: any) => ({
      usd: sum.usd + Number(item.priceUsd ?? 0) * Number(item.qty ?? 1),
      fcfa: sum.fcfa + Number(item.priceFcfa ?? 0) * Number(item.qty ?? 1),
    }), { usd: 0, fcfa: 0 });
  }, [manual.items]);

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
      setManualProduct({ product_id: "", qty: 1 });
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
              setManual({ ...manual, country_code: countryCode, city: country.cities[0]?.name ?? "", commune: "" });
            }} className="input-admin">
              {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
            </select>
            <select value={manual.city} onChange={(e) => setManual({ ...manual, city: e.target.value, commune: "" })} className="input-admin">
              {(findCountry(manual.country_code)?.cities ?? []).map((city) => <option key={city.name} value={city.name}>{city.name}</option>)}
            </select>
            <input placeholder="Commune / quartier" value={manual.commune} onChange={(e) => setManual({ ...manual, commune: e.target.value })} className="input-admin" />
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
            <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
              <select value={manualProduct.product_id} onChange={(e) => setManualProduct({ ...manualProduct, product_id: e.target.value })} className="input-admin">
                <option value="">Sélectionner un produit</option>
                {(products.data ?? []).map((product: any) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — ${product.price_usd} / {Number(product.price_fcfa).toLocaleString("fr-FR")} FCFA
                  </option>
                ))}
              </select>
              <input type="number" min={1} value={manualProduct.qty} onChange={(e) => setManualProduct({ ...manualProduct, qty: Number.parseInt(e.target.value || "1", 10) })} className="input-admin" />
              <button
                type="button"
                className="rounded bg-espresso px-4 py-2 text-xs font-medium uppercase tracking-widest text-cream disabled:opacity-50"
                disabled={!selectedProduct}
                onClick={() => {
                  if (!selectedProduct) return;
                  const item = {
                    slug: selectedProduct.slug,
                    name: selectedProduct.name,
                    variantId: selectedProduct.id,
                    variantLabel: "Format standard",
                    qty: Math.max(1, manualProduct.qty || 1),
                    priceUsd: Number(selectedProduct.price_usd ?? 0),
                    priceFcfa: Number(selectedProduct.price_fcfa ?? 0),
                  };
                  const existingIndex = manual.items.findIndex((current: any) => current.variantId === item.variantId);
                  const nextItems = existingIndex >= 0
                    ? manual.items.map((current: any, index: number) => index === existingIndex ? { ...current, qty: current.qty + item.qty } : current)
                    : [...manual.items, item];
                  setManual({ ...manual, items: nextItems });
                  setManualProduct({ product_id: "", qty: 1 });
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
                    <strong>{item.qty} × {item.name}</strong>
                    <div className="text-xs text-muted-foreground">
                      {(item.priceFcfa * item.qty).toLocaleString("fr-FR")} FCFA · ${item.priceUsd * item.qty}
                    </div>
                  </div>
                  <button type="button" onClick={() => setManual({ ...manual, items: manual.items.filter((current: any) => current.variantId !== item.variantId) })} className="rounded-full p-2 text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-clay p-4 text-sm">
              Total automatique : <strong>{manualTotals.fcfa.toLocaleString("fr-FR")} FCFA</strong> · ${manualTotals.usd}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setManualOpen(false)}>Annuler</button>
            <button
              className="btn-hero"
              disabled={createMut.isPending || manual.items.length === 0}
              onClick={() => {
                const country = findCountry(manual.country_code)!;
                createMut.mutate({
                  ...manual,
                  country_name: country.name,
                  total_usd: manualTotals.usd,
                  total_fcfa: manualTotals.fcfa,
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
            const totalLabel = formatScopedMoney(o, o.city_scope);
            const customerMsg = `Bonjour ${o.customer_name}, votre commande *${o.order_number}* chez The Sisters est maintenant *${meta.label.toLowerCase()}*.\n\n${itemsTxt}\n\nTotal : ${totalLabel}`;
            const driverMsg = o.driver ? `Bonjour ${o.driver.full_name ?? ""}, nouvelle livraison à effectuer :\n\nCommande : *${o.order_number}*\nClient : ${o.customer_name} (${o.customer_phone})\nAdresse : ${o.address}, ${o.commune}, ${o.city}\nLivraison : ${deliveryLabel(o)}\n${o.notes ? "Notes : " + o.notes + "\n" : ""}\nArticles :\n${itemsTxt}\n\nTotal à encaisser : ${totalLabel}` : "";
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
                    <div className="font-display text-2xl text-copper">{totalLabel}</div>
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
                    <div className="text-espresso flex items-start gap-1"><MapPin className="w-3 h-3 mt-1 shrink-0" /><span>{o.address}<br/>{o.commune}, {o.city} — {o.country_name}</span></div>
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
