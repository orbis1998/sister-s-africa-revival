import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { StaffShell } from "@/components/admin/AdminLayout";
import { Truck, MapPin, Phone, MessageCircle, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listOrders, updateOrderStatus } from "@/lib/orders.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/livreur")({
  component: LivreurDashboard,
});

const FLOW: Array<{ value: any; label: string }> = [
  { value: "ready", label: "Préparée" },
  { value: "en_route", label: "En route" },
  { value: "delivered", label: "Livrée" },
];

function deliveryLabel(order: any) {
  if (!order.delivery_date && !order.delivery_time) return "Non précisée";
  const date = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString("fr-FR") : "";
  return [date, order.delivery_time].filter(Boolean).join(" à ");
}

function LivreurDashboard() {
  const { user } = useAuth();
  const list = useServerFn(listOrders);
  const upd = useServerFn(updateOrderStatus);
  const qc = useQueryClient();
  const orders = useQuery({ queryKey: ["orders", "livreur"], queryFn: () => list() });
  const mut = useMutation({
    mutationFn: (v: { order_id: string; status: any }) => upd({ data: v }),
    onSuccess: () => { toast.success("Statut mis à jour"); qc.invalidateQueries({ queryKey: ["orders", "livreur"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const active = (orders.data ?? []).filter((o: any) => o.status !== "delivered" && o.status !== "cancelled");

  return (
    <StaffShell title="Livreur" requiredRole="livreur">
      <span className="eyebrow">Espace livreur</span>
      <h1 className="font-display text-4xl mt-2">Mes livraisons</h1>
      <p className="text-muted-foreground mt-2 text-sm">{user?.email}</p>

      {orders.isLoading ? (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
      ) : active.length === 0 ? (
        <div className="mt-8 bg-card border border-border rounded-2xl p-10 text-center">
          <Truck className="w-10 h-10 text-copper mx-auto" strokeWidth={1.5} />
          <h2 className="font-display text-2xl mt-4">Aucune course assignée</h2>
          <p className="text-sm text-muted-foreground mt-2">Les courses apparaîtront ici dès qu'elles vous seront attribuées.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {active.map((o: any) => {
            const itemsTxt = (o.items as any[]).map((it) => `• ${it.qty} × ${it.name}`).join("\n");
            const msg = `Bonjour ${o.customer_name}, je suis votre livreur The Sisters pour la commande *${o.order_number}*. Je me dirige vers vous.`;
            const phone = o.customer_phone.replace(/[^\d]/g, "");
            return (
              <div key={o.id} className="bg-card border border-border rounded p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-display text-xl">{o.order_number}</div>
                    <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("fr-FR")}</div>
                    <div className="mt-1 text-xs text-copper">Livraison : {deliveryLabel(o)}</div>
                  </div>
                  <div className="font-display text-copper">{o.total_fcfa.toLocaleString("fr-FR")} FCFA</div>
                </div>
                <div className="text-sm space-y-1 mb-3">
                  <div className="text-espresso font-medium">{o.customer_name}</div>
                  <div className="text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{o.customer_phone}</div>
                  <div className="text-espresso flex items-start gap-1"><MapPin className="w-3 h-3 mt-1 shrink-0" /><span>{o.address}, {o.commune}, {o.city}</span></div>
                  <div className="text-muted-foreground">Créneau : {deliveryLabel(o)}</div>
                </div>
                <pre className="text-xs bg-cream/60 border border-border rounded p-2 mb-3 whitespace-pre-wrap font-sans">{itemsTxt}</pre>
                <div className="flex gap-2 flex-wrap">
                  {FLOW.map((s) => (
                    <button key={s.value}
                      onClick={() => mut.mutate({ order_id: o.id, status: s.value })}
                      disabled={o.status === s.value}
                      className={`text-xs px-3 py-2 rounded border ${o.status === s.value ? "bg-espresso text-cream border-espresso" : "border-border hover:bg-cream"}`}>
                      {s.label}
                    </button>
                  ))}
                  <a href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"
                    className="ml-auto flex items-center gap-1 text-xs bg-[#25D366] text-white px-3 py-2 rounded">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp client
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StaffShell>
  );
}
