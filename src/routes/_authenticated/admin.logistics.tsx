import { createFileRoute } from "@tanstack/react-router";
import { StaffShell } from "@/components/admin/AdminLayout";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listOrders, listDrivers, assignOrder, updateOrderStatus } from "@/lib/orders.functions";
import { Loader2, MessageCircle, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

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

function LogisticsPage() {
  const list = useServerFn(listOrders);
  const drv = useServerFn(listDrivers);
  const assign = useServerFn(assignOrder);
  const upd = useServerFn(updateOrderStatus);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const orders = useQuery({ queryKey: ["orders"], queryFn: () => list() });
  const drivers = useQuery({ queryKey: ["drivers"], queryFn: () => drv() });

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

  const filtered = (orders.data ?? []).filter((o: any) => filter === "all" ? true : o.status === filter);

  return (
    <StaffShell title="Admin" requiredRole="admin">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="eyebrow mb-2">Logistique</div>
          <h1 className="font-display text-4xl text-espresso">Commandes & livraisons</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter("all")} className={`px-3 py-1.5 text-xs rounded-full border ${filter==="all"?"bg-espresso text-cream border-espresso":"border-border"}`}>Toutes</button>
          {STATUS_OPTIONS.map((s) => (
            <button key={s.value} onClick={() => setFilter(s.value)} className={`px-3 py-1.5 text-xs rounded-full border ${filter===s.value?"bg-espresso text-cream border-espresso":"border-border"}`}>{s.label}</button>
          ))}
        </div>
      </div>

      {orders.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded p-12 text-center text-muted-foreground">Aucune commande pour ce filtre.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((o: any) => {
            const meta = statusMeta(o.status);
            const itemsTxt = (o.items as any[]).map((it) => `• ${it.qty} × ${it.name} (${it.variantLabel})`).join("\n");
            const customerMsg = `Bonjour ${o.customer_name}, votre commande *${o.order_number}* chez The Sisters est maintenant *${meta.label.toLowerCase()}*.\n\n${itemsTxt}\n\nTotal : ${o.total_fcfa.toLocaleString("fr-FR")} FCFA`;
            const driverMsg = o.driver ? `Bonjour ${o.driver.full_name ?? ""}, nouvelle livraison à effectuer :\n\nCommande : *${o.order_number}*\nClient : ${o.customer_name} (${o.customer_phone})\nAdresse : ${o.address}, ${o.commune}, ${o.city}\n${o.notes ? "Notes : " + o.notes + "\n" : ""}\nArticles :\n${itemsTxt}\n\nTotal à encaisser : ${o.total_fcfa.toLocaleString("fr-FR")} FCFA` : "";
            return (
              <div key={o.id} className="bg-card border border-border rounded p-5">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-display text-xl text-espresso">{o.order_number}</span>
                      <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${meta.tone}`}>{meta.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("fr-FR")}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl text-copper">${Number(o.total_usd).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{o.total_fcfa.toLocaleString("fr-FR")} FCFA</div>
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
