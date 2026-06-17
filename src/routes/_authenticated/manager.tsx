import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StaffShell } from "@/components/admin/AdminLayout";

export const Route = createFileRoute("/_authenticated/manager")({
  component: ManagerDashboard,
});

const labels: Record<string, string> = {
  can_manage_products: "Produits", can_manage_stock: "Stock", can_manage_orders: "Commandes",
  can_manage_logistics: "Logistique", can_view_accounting: "Comptabilité",
  can_manage_pos: "Points de vente", can_manage_users: "Utilisateurs",
};

function ManagerDashboard() {
  const { user } = useAuth();
  const { data: perms } = useQuery({
    queryKey: ["manager-perms", user?.id],
    queryFn: async () => user ? (await supabase.from("manager_permissions").select("*").eq("user_id", user.id).maybeSingle()).data : null,
    enabled: !!user,
  });

  const granted = perms ? Object.entries(perms).filter(([k, v]) => k.startsWith("can_") && v === true).map(([k]) => labels[k]).filter(Boolean) : [];

  return (
    <StaffShell title="Manager" requiredRole="manager">
      <span className="eyebrow">Espace manager</span>
      <h1 className="font-display text-4xl mt-2">Tableau de bord</h1>
      <p className="text-muted-foreground mt-2">Vos permissions sont définies par l'administration.</p>
      <div className="mt-8 bg-card border border-border rounded-2xl p-6">
        <h2 className="font-display text-xl">Vos accès</h2>
        {granted.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">Aucune permission accordée. Contactez votre administrateur.</p>
        ) : (
          <div className="flex flex-wrap gap-2 mt-3">
            {granted.map((g) => <span key={g} className="px-3 py-1 rounded-full bg-copper/15 text-copper text-xs uppercase tracking-widest">{g}</span>)}
          </div>
        )}
        {perms?.notes && <p className="text-sm text-muted-foreground mt-4 italic">Note: {perms.notes}</p>}
      </div>
    </StaffShell>
  );
}
