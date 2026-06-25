import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell } from "@/components/admin/AdminLayout";
import { exportCompanyReport, exportCompanyReportPdf } from "@/lib/accounting.functions";
import { listStaffExpenses, listWholesaleSales } from "@/lib/finance.functions";
import { getMyManagerPermissions } from "@/lib/permissions.functions";
import { useAuth } from "@/lib/auth";
import { directionLabel, formatOrderAmount, formatScopedMoney } from "@/lib/staff-scope";
import { ClipboardList, Download, FileText, HandCoins, ShoppingCart, TrendingUp, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/manager/accounting")({
  component: ManagerAccountingPage,
});

function Stat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-copper" strokeWidth={1.5} />
      </div>
      <div className="font-display text-3xl mt-2">{value}</div>
      {sub && <div className="text-xs mt-1 text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ManagerAccountingPage() {
  const { user } = useAuth();
  const listExpenses = useServerFn(listStaffExpenses);
  const listWholesale = useServerFn(listWholesaleSales);
  const exportReportFn = useServerFn(exportCompanyReport);
  const exportPdfFn = useServerFn(exportCompanyReportPdf);
  const [reportFrom, setReportFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["manager-accounting-profile", user?.id],
    enabled: !!user,
    queryFn: async () => user ? (await supabase.from("profiles").select("city_scope").eq("id", user.id).maybeSingle()).data : null,
  });
  const fetchManagerPerms = useServerFn(getMyManagerPermissions);
  const { data: managerPerms } = useQuery({
    queryKey: ["manager-permissions", user?.id],
    enabled: !!user,
    queryFn: () => fetchManagerPerms({}),
    staleTime: 30_000,
  });
  const posIds = (managerPerms?.pos_ids ?? []) as string[];

  const { data: deliveredOrders = [] } = useQuery({
    queryKey: ["manager-accounting-orders", profile?.city_scope],
    enabled: !!profile?.city_scope,
    queryFn: async () => (await supabase.from("orders").select("*").eq("status", "delivered").eq("city_scope", profile!.city_scope!).order("delivered_at", { ascending: false }).limit(200)).data ?? [],
  });
  const { data: posSales = [] } = useQuery({
    queryKey: ["manager-accounting-pos", user?.id, posIds.join(",")],
    enabled: posIds.length > 0,
    queryFn: async () => (await supabase.from("pos_sales").select("*").in("pos_id", posIds).order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const { data: wholesaleSales = [] } = useQuery({
    queryKey: ["manager-accounting-wholesale", user?.id],
    queryFn: () => listWholesale({}),
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["manager-accounting-expenses", user?.id],
    queryFn: () => listExpenses({}),
  });

  const totals = useMemo(() => {
    const sumRows = (rows: any[], usdKey: string, fcfaKey: string) => rows.reduce(
      (acc, row) => ({ usd: acc.usd + Number(row[usdKey] ?? 0), fcfa: acc.fcfa + Number(row[fcfaKey] ?? 0) }),
      { usd: 0, fcfa: 0 },
    );
    const delivered = sumRows(deliveredOrders, "total_usd", "total_fcfa");
    const pos = sumRows(posSales, "total_usd", "total_fcfa");
    const wholesale = sumRows(wholesaleSales, "total_usd", "total_fcfa");
    const expenseTotal = sumRows(expenses, "amount_usd", "amount_fcfa");
    const revenue = { usd: delivered.usd + pos.usd + wholesale.usd, fcfa: delivered.fcfa + pos.fcfa + wholesale.fcfa };
    return { delivered, pos, wholesale, expenseTotal, revenue, net: { usd: revenue.usd - expenseTotal.usd, fcfa: revenue.fcfa - expenseTotal.fcfa } };
  }, [deliveredOrders, posSales, wholesaleSales, expenses]);

  const scope = profile?.city_scope;

  async function downloadReport(format: "csv" | "pdf") {
    try {
      if (format === "csv") setExporting(true);
      else setExportingPdf(true);
      const result = format === "csv"
        ? await exportReportFn({ data: { from: reportFrom, to: reportTo } })
        : await exportPdfFn({ data: { from: reportFrom, to: reportTo } });
      const blob = format === "csv"
        ? new Blob([`\uFEFF${(result as any).csv}`], { type: "text/csv;charset=utf-8" })
        : (() => {
            const bytes = Uint8Array.from(atob((result as any).pdfBase64), (c) => c.charCodeAt(0));
            return new Blob([bytes], { type: "application/pdf" });
          })();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(format === "csv" ? "Rapport CSV téléchargé" : "Rapport PDF téléchargé");
    } catch (e: any) {
      toast.error(e.message ?? "Export impossible");
    } finally {
      setExporting(false);
      setExportingPdf(false);
    }
  }

  return (
    <StaffShell title="Manager" requiredRole="manager" requiredPermission="can_view_accounting">
      <span className="eyebrow">Comptabilité</span>
      <div className="flex flex-wrap items-end justify-between gap-4 mt-2">
        <div>
          <h1 className="font-display text-4xl">Comptabilité générale</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Direction : <strong>{directionLabel(scope)}</strong> — commandes site, POS, ventes en gros et dépenses.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className="input-admin !py-2 !text-sm" />
          <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="input-admin !py-2 !text-sm" />
          <button onClick={() => downloadReport("csv")} disabled={exporting || exportingPdf} className="btn-hero !py-2 !text-xs">
            <Download className="w-4 h-4" /> {exporting ? "Export..." : "CSV"}
          </button>
          <button onClick={() => downloadReport("pdf")} disabled={exporting || exportingPdf} className="btn-ghost !py-2 !text-xs border border-border">
            <FileText className="w-4 h-4" /> {exportingPdf ? "PDF..." : "PDF pro"}
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={ClipboardList} label="Commandes livrées (site)" value={formatScopedMoney({ total_usd: totals.delivered.usd, total_fcfa: totals.delivered.fcfa }, scope)} sub={`${deliveredOrders.length} commande(s)`} />
        <Stat icon={ShoppingCart} label="Ventes POS" value={formatScopedMoney({ total_usd: totals.pos.usd, total_fcfa: totals.pos.fcfa }, scope)} sub={`${posSales.length} vente(s)`} />
        <Stat icon={HandCoins} label="Ventes en gros" value={formatScopedMoney({ total_usd: totals.wholesale.usd, total_fcfa: totals.wholesale.fcfa }, scope)} sub={`${wholesaleSales.length} vente(s)`} />
        <Stat icon={Wallet} label="Dépenses signalées" value={formatScopedMoney({ total_usd: totals.expenseTotal.usd, total_fcfa: totals.expenseTotal.fcfa }, scope)} sub={`${expenses.length} dépense(s)`} />
        <Stat icon={TrendingUp} label="Recettes totales" value={formatScopedMoney({ total_usd: totals.revenue.usd, total_fcfa: totals.revenue.fcfa }, scope)} />
        <Stat icon={TrendingUp} label="CA net" value={formatScopedMoney({ total_usd: totals.net.usd, total_fcfa: totals.net.fcfa }, scope)} sub="Recettes − dépenses" />
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Journal des opérations</h2>
        <p className="mt-1 text-xs text-muted-foreground">Hors frais de livraison — produits uniquement.</p>
        <div className="mt-5 max-h-[520px] overflow-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-cream text-left text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="p-3">Type</th>
                <th className="p-3">Réf.</th>
                <th className="p-3">Date</th>
                <th className="p-3">Client / Note</th>
                <th className="p-3">Montant</th>
                <th className="p-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {[
                ...deliveredOrders.map((o: any) => ({
                  key: `order-${o.id}`,
                  type: "Commande site",
                  ref: o.order_number,
                  date: o.delivered_at ?? o.created_at,
                  label: o.customer_name,
                  amount: formatOrderAmount(o),
                  status: o.status,
                })),
                ...posSales.map((s: any) => ({
                  key: `pos-${s.id}`,
                  type: "POS",
                  ref: String(s.id).slice(0, 8),
                  date: s.created_at,
                  label: s.customer_name || "Client comptoir",
                  amount: formatScopedMoney({ total_usd: s.total_usd, total_fcfa: s.total_fcfa }, scope),
                  status: s.payment_method ?? "cash",
                })),
                ...wholesaleSales.map((s: any) => ({
                  key: `wholesale-${s.id}`,
                  type: "Vente en gros",
                  ref: String(s.id).slice(0, 8),
                  date: s.sold_at,
                  label: `${s.product_name} × ${s.quantity} — ${s.customer_name}`,
                  amount: formatScopedMoney({ total_usd: s.total_usd, total_fcfa: s.total_fcfa }, scope),
                  status: s.payment_status,
                })),
                ...expenses.map((e: any) => ({
                  key: `expense-${e.id}`,
                  type: "Dépense",
                  ref: String(e.id).slice(0, 8),
                  date: e.spent_at,
                  label: e.note,
                  amount: formatScopedMoney({ total_usd: e.amount_usd, total_fcfa: e.amount_fcfa }, scope),
                  status: "dépense",
                })),
              ]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((row) => (
                  <tr key={row.key} className="border-t border-border">
                    <td className="p-3">{row.type}</td>
                    <td className="p-3 font-mono text-xs">{row.ref}</td>
                    <td className="p-3">{new Date(row.date).toLocaleDateString("fr-FR")}</td>
                    <td className="p-3">{row.label}</td>
                    <td className="p-3 font-medium text-copper">{row.amount}</td>
                    <td className="p-3 text-xs text-muted-foreground">{row.status}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </StaffShell>
  );
}
