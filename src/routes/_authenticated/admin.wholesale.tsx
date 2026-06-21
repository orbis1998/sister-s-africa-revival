import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { StaffShell } from "@/components/admin/AdminLayout";
import { listWholesaleSales } from "@/lib/finance.functions";
import { ADMIN_REPORT_REGIONS, directionLabel, formatScopedMoney } from "@/lib/staff-scope";

export const Route = createFileRoute("/_authenticated/admin/wholesale")({
  component: WholesaleAdminPage,
});

function WholesaleAdminPage() {
  const listWholesale = useServerFn(listWholesaleSales);
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["admin-wholesale-sales"],
    queryFn: () => listWholesale({}),
  });

  const totals = sales.reduce((sum: { usd: number; fcfa: number }, sale: any) => ({
    usd: sum.usd + Number(sale.total_usd ?? 0),
    fcfa: sum.fcfa + Number(sale.total_fcfa ?? 0),
  }), { usd: 0, fcfa: 0 });

  const byRegion = ADMIN_REPORT_REGIONS.map((region) => {
    const rows = sales.filter((sale: any) => region.scopes.includes(sale.city_scope));
    return {
      region,
      count: rows.length,
      usd: rows.reduce((sum: number, sale: any) => sum + Number(sale.total_usd ?? 0), 0),
      fcfa: rows.reduce((sum: number, sale: any) => sum + Number(sale.total_fcfa ?? 0), 0),
    };
  });

  return (
    <StaffShell title="Administration" requiredRole={["admin", "manager"]}>
      <span className="eyebrow">Commercial</span>
      <h1 className="font-display text-4xl mt-2">Ventes en gros</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Suivi des ventes en gros enregistrées par les managers, avec prix fixé manuellement.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Total USD" value={`$${totals.usd.toFixed(2)}`} />
        <Stat label="Total FCFA" value={`${totals.fcfa.toLocaleString("fr-FR")} FCFA`} />
        <Stat label="Nombre de ventes" value={sales.length} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {byRegion.map((row) => (
          <div key={row.region.key} className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-xl">{row.region.label}</h2>
            <div className="mt-3 text-sm text-muted-foreground">{row.count} vente(s)</div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="font-medium text-copper">${row.usd.toFixed(2)}</div>
              <div className="text-muted-foreground">{row.fcfa.toLocaleString("fr-FR")} FCFA</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-clay/50 text-left text-xs uppercase tracking-widest">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Direction</th>
              <th className="p-3">Client</th>
              <th className="p-3">Produit</th>
              <th className="p-3">Qté</th>
              <th className="p-3">Prix unitaire</th>
              <th className="p-3">Total</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Manager</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Chargement...</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Aucune vente en gros.</td></tr>
            ) : sales.map((sale: any) => (
              <tr key={sale.id} className="border-t border-border">
                <td className="p-3">{new Date(sale.sold_at).toLocaleDateString("fr-FR")}</td>
                <td className="p-3">{directionLabel(sale.city_scope)}</td>
                <td className="p-3">
                  <div>{sale.customer_name}</div>
                  {sale.customer_phone && <div className="text-xs text-muted-foreground">{sale.customer_phone}</div>}
                </td>
                <td className="p-3">{sale.product_name}</td>
                <td className="p-3">{sale.quantity}</td>
                <td className="p-3">{formatScopedMoney({ total_usd: sale.unit_price_usd, total_fcfa: sale.unit_price_fcfa }, sale.city_scope)}</td>
                <td className="p-3 font-medium text-copper">{formatScopedMoney({ total_usd: sale.total_usd, total_fcfa: sale.total_fcfa }, sale.city_scope)}</td>
                <td className="p-3">{statusLabel(sale.payment_status)}</td>
                <td className="p-3 text-xs text-muted-foreground">{sale.profiles?.full_name ?? sale.profiles?.badge_id ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-3xl mt-2">{value}</div>
    </div>
  );
}

function statusLabel(status: string) {
  return {
    pending: "En attente",
    paid: "Payée",
    partial: "Partielle",
    cancelled: "Annulée",
  }[status] ?? status;
}
