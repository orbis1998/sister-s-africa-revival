import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { StaffShell } from "@/components/admin/AdminLayout";
import { listStaffExpenses, deleteStaffExpense } from "@/lib/finance.functions";
import { directionLabel, formatScopedMoney } from "@/lib/staff-scope";

export const Route = createFileRoute("/_authenticated/admin/expenses")({
  component: AdminExpensesPage,
});

function AdminExpensesPage() {
  const listExpenses = useServerFn(listStaffExpenses);
  const deleteExpense = useServerFn(deleteStaffExpense);
  const [filterScope, setFilterScope] = useState<string>("");

  const { data: expenses = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-expenses"],
    queryFn: () => listExpenses({}),
  });

  const scopes = Array.from(new Set(expenses.map((e: any) => e.city_scope).filter(Boolean)));
  const filtered = filterScope ? expenses.filter((e: any) => e.city_scope === filterScope) : expenses;

  const total = filtered.reduce((acc: { usd: number; fcfa: number }, item: any) => ({
    usd: acc.usd + Number(item.amount_usd ?? 0),
    fcfa: acc.fcfa + Number(item.amount_fcfa ?? 0),
  }), { usd: 0, fcfa: 0 });

  return (
    <StaffShell title="Administration" requiredRole="admin">
      <span className="eyebrow">Comptabilité</span>
      <h1 className="font-display text-4xl mt-2">Dépenses signalées</h1>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Filtrer par direction</label>
          <select value={filterScope} onChange={(e) => setFilterScope(e.target.value)} className="input-admin">
            <option value="">Toutes les directions</option>
            {scopes.map((scope) => (
              <option key={scope} value={scope}>{directionLabel(scope)}</option>
            ))}
          </select>
        </div>
        <div className="rounded-2xl border border-border bg-card px-5 py-3">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Total filtré</div>
          <div className="font-display text-xl mt-1">
            ${total.usd.toFixed(2)} · {total.fcfa.toLocaleString("fr-FR")} FCFA
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-cream text-left text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Direction</th>
                <th className="p-3">Signalé par</th>
                <th className="p-3">Montant</th>
                <th className="p-3">Note</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucune dépense.</td></tr>
              ) : (
                filtered.map((item: any) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="p-3">{new Date(item.spent_at).toLocaleString("fr-FR")}</td>
                    <td className="p-3">{directionLabel(item.city_scope)}</td>
                    <td className="p-3">{item.profiles?.full_name ?? item.profiles?.badge_id ?? "—"}</td>
                    <td className="p-3 font-medium">
                      {formatScopedMoney({ total_usd: item.amount_usd, total_fcfa: item.amount_fcfa }, item.city_scope)}
                    </td>
                    <td className="p-3 max-w-xs truncate">{item.note}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm("Supprimer cette dépense ?")) return;
                          try {
                            await deleteExpense({ data: { id: item.id } });
                            toast.success("Dépense supprimée");
                            refetch();
                          } catch (e: any) {
                            toast.error(e.message);
                          }
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </StaffShell>
  );
}
