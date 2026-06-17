import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell } from "@/components/admin/AdminLayout";
import { AlertTriangle, ClipboardList, DollarSign, MessageSquare, Package, ShoppingCart, Store } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function Stat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4 text-copper" strokeWidth={1.5} />
      </div>
      <div className="font-display text-4xl mt-2">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function AdminDashboard() {
  const { data: products } = useQuery({
    queryKey: ["admin-products"], queryFn: async () => (await supabase.from("products").select("id")).data ?? [],
  });
  const { data: pos } = useQuery({
    queryKey: ["admin-pos"], queryFn: async () => (await supabase.from("points_of_sale").select("id")).data ?? [],
  });
  const { data: stock } = useQuery({
    queryKey: ["admin-low-stock"], queryFn: async () => (await supabase.from("stock").select("*")).data ?? [],
  });
  const { data: orders } = useQuery({
    queryKey: ["admin-dashboard-orders"],
    queryFn: async () => (await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(8)).data ?? [],
  });
  const { data: reviews } = useQuery({
    queryKey: ["admin-dashboard-reviews"],
    queryFn: async () => (await supabase.from("reviews").select("id, approved")).data ?? [],
  });
  const { data: sales } = useQuery({
    queryKey: ["admin-dashboard-pos-sales"],
    queryFn: async () => {
      const { data } = await supabase.from("pos_sales").select("total_fcfa,total_usd,created_at");
      return data ?? [];
    },
  });
  const lowStock = (stock ?? []).filter((s: any) => s.quantity <= s.low_stock_threshold).length;
  const revenueFcfa = (orders ?? []).reduce((sum: number, o: any) => sum + (o.status === "cancelled" ? 0 : Number(o.total_fcfa ?? 0)), 0);
  const posRevenueFcfa = (sales ?? []).reduce((sum: number, s: any) => sum + Number(s.total_fcfa ?? 0), 0);
  const pendingReviews = (reviews ?? []).filter((r: any) => !r.approved).length;

  return (
    <StaffShell title="Administration" requiredRole="admin">
      <span className="eyebrow">Vue d'ensemble</span>
      <h1 className="font-display text-4xl mt-2">Tableau de bord</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <Stat icon={Package} label="Produits" value={products?.length ?? 0} />
        <Stat icon={Store} label="Points de vente" value={pos?.length ?? 0} />
        <Stat icon={AlertTriangle} label="Alertes stock" value={lowStock} />
        <Stat icon={ClipboardList} label="Commandes" value={orders?.length ?? 0} sub="Dernières commandes" />
        <Stat icon={DollarSign} label="CA commandes" value={`${revenueFcfa.toLocaleString("fr-FR")} FCFA`} />
        <Stat icon={ShoppingCart} label="Ventes POS" value={`${posRevenueFcfa.toLocaleString("fr-FR")} FCFA`} />
        <Stat icon={MessageSquare} label="Avis à valider" value={pendingReviews} />
        <Stat icon={Store} label="Système" value="OK" sub="Admin, stock, POS, logistique" />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display text-2xl">Dernières commandes</h2>
          <div className="mt-5 space-y-3">
            {(orders ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune commande pour le moment.</p>
            ) : (
              (orders ?? []).slice(0, 6).map((o: any) => (
                <div key={o.id} className="flex items-center justify-between gap-4 rounded-xl bg-cream/60 p-3">
                  <div>
                    <div className="font-medium text-espresso">{o.order_number}</div>
                    <div className="text-xs text-muted-foreground">{o.customer_name} · {o.city}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg text-copper">{Number(o.total_fcfa).toLocaleString("fr-FR")} FCFA</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{o.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-espresso text-cream rounded-2xl p-6">
          <h2 className="font-display text-2xl">Pilotage rapide</h2>
          <p className="text-sm text-cream/70 mt-2">
            Surveillez les commandes, les ventes POS, le stock bas et les avis en attente depuis un seul écran.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-cream/10 p-4">
              <div className="font-display text-2xl text-gold">{lowStock}</div>
              <div className="text-cream/60">stocks bas</div>
            </div>
            <div className="rounded-xl bg-cream/10 p-4">
              <div className="font-display text-2xl text-gold">{pendingReviews}</div>
              <div className="text-cream/60">avis à valider</div>
            </div>
          </div>
        </div>
      </div>
    </StaffShell>
  );
}
