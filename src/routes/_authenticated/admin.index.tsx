import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell } from "@/components/admin/AdminLayout";
import { Package, Users, Store, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4 text-copper" strokeWidth={1.5} />
      </div>
      <div className="font-display text-4xl mt-2">{value}</div>
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
  const lowStock = (stock ?? []).filter((s: any) => s.quantity <= s.low_stock_threshold).length;

  return (
    <StaffShell title="Administration" requiredRole="admin">
      <span className="eyebrow">Vue d'ensemble</span>
      <h1 className="font-display text-4xl mt-2">Tableau de bord</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <Stat icon={Package} label="Produits" value={products?.length ?? 0} />
        <Stat icon={Store} label="Points de vente" value={pos?.length ?? 0} />
        <Stat icon={AlertTriangle} label="Alertes stock" value={lowStock} />
        <Stat icon={Users} label="Système" value="OK" />
      </div>
      <div className="mt-10 bg-card border border-border rounded-2xl p-6">
        <h2 className="font-display text-2xl">Bienvenue</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Gérez ici vos produits, votre stock multi-POS, vos points de vente et créez les comptes manager / livreur.
        </p>
      </div>
    </StaffShell>
  );
}
