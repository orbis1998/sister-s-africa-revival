import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StaffShell } from "@/components/admin/AdminLayout";
import { createStaffExpense, listStaffExpenses } from "@/lib/finance.functions";
import { directionLabel, formatScopedMoney } from "@/lib/staff-scope";
import { useState } from "react";
import { toast } from "sonner";

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
  const qc = useQueryClient();
  const createExpense = useServerFn(createStaffExpense);
  const listExpenses = useServerFn(listStaffExpenses);
  const [expense, setExpense] = useState({ amount_usd: "", amount_fcfa: "", note: "" });
  const { data: perms } = useQuery({
    queryKey: ["manager-perms", user?.id],
    queryFn: async () => user ? (await supabase.from("manager_permissions").select("*").eq("user_id", user.id).maybeSingle()).data : null,
    enabled: !!user,
  });
  const { data: profile } = useQuery({
    queryKey: ["manager-profile", user?.id],
    queryFn: async () => user ? (await supabase.from("profiles").select("city_scope").eq("id", user.id).maybeSingle()).data : null,
    enabled: !!user,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["manager-expenses"],
    queryFn: () => listExpenses({}),
  });
  const expenseMut = useMutation({
    mutationFn: () => createExpense({
      data: {
        amount_usd: Number(expense.amount_usd || 0),
        amount_fcfa: Number.parseInt(expense.amount_fcfa || "0", 10),
        note: expense.note,
      },
    }),
    onSuccess: () => {
      toast.success("Dépense signalée");
      setExpense({ amount_usd: "", amount_fcfa: "", note: "" });
      qc.invalidateQueries({ queryKey: ["manager-expenses"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const granted = perms ? Object.entries(perms).filter(([k, v]) => k.startsWith("can_") && v === true).map(([k]) => labels[k]).filter(Boolean) : [];
  const monthExpenses = expenses.reduce((sum: { usd: number; fcfa: number }, item: any) => {
    const d = new Date(item.spent_at);
    const now = new Date();
    if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return sum;
    return {
      usd: sum.usd + Number(item.amount_usd ?? 0),
      fcfa: sum.fcfa + Number(item.amount_fcfa ?? 0),
    };
  }, { usd: 0, fcfa: 0 });

  return (
    <StaffShell title="Manager" requiredRole="manager">
      <span className="eyebrow">Espace manager</span>
      <h1 className="font-display text-4xl mt-2">Tableau de bord</h1>
      <p className="text-muted-foreground mt-2">
        Direction : <strong>{directionLabel(profile?.city_scope)}</strong>. Vos permissions sont définies par l'administration.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Dépenses du mois</div>
          <div className="font-display text-4xl mt-2">{formatScopedMoney({ total_usd: monthExpenses.usd, total_fcfa: monthExpenses.fcfa }, profile?.city_scope)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Dépenses signalées</div>
          <div className="font-display text-4xl mt-2">{expenses.length}</div>
        </div>
      </div>
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
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl">Signaler une dépense</h2>
          <div className="mt-5 grid gap-3">
            <input type="number" min={0} step="0.01" placeholder="Montant USD" value={expense.amount_usd} onChange={(e) => setExpense({ ...expense, amount_usd: e.target.value })} className="input-admin" />
            <input type="number" min={0} placeholder="Montant FCFA" value={expense.amount_fcfa} onChange={(e) => setExpense({ ...expense, amount_fcfa: e.target.value })} className="input-admin" />
            <textarea placeholder="Note / justification" value={expense.note} onChange={(e) => setExpense({ ...expense, note: e.target.value })} className="input-admin resize-none" rows={4} />
            <button disabled={expenseMut.isPending || !expense.note.trim()} onClick={() => expenseMut.mutate()} className="btn-hero disabled:opacity-50">
              {expenseMut.isPending ? "Enregistrement..." : "Enregistrer la dépense"}
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl">Dernières dépenses</h2>
          <div className="mt-5 space-y-3">
            {expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune dépense signalée.</p>
            ) : expenses.slice(0, 8).map((item: any) => (
              <div key={item.id} className="rounded-xl bg-cream/70 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <strong>{formatScopedMoney({ total_usd: item.amount_usd, total_fcfa: item.amount_fcfa }, item.city_scope)}</strong>
                  <span className="text-xs text-muted-foreground">{new Date(item.spent_at).toLocaleDateString("fr-FR")}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StaffShell>
  );
}
