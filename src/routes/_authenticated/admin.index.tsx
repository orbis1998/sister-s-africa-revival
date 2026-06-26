import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell } from "@/components/admin/AdminLayout";
import { exportCompanyReport, exportCompanyReportPdf } from "@/lib/accounting.functions";
import { listStaffExpenses, listWholesaleSales } from "@/lib/finance.functions";
import { ADMIN_REPORT_REGIONS, directionFromCity, formatOrderAmount, formatRegionMoney } from "@/lib/staff-scope";
import { LIVE_STATS_QUERY_OPTIONS } from "@/lib/live-stats-query";
import { AlertTriangle, ClipboardList, DollarSign, Download, FileText, HandCoins, MessageSquare, Package, ShoppingCart, Store, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function Stat({ icon: Icon, label, value, sub, dark }: { icon: any; label: string; value: string | number; sub?: string; dark?: boolean }) {
  return (
    <div className={`${dark ? "bg-espresso text-cream border-espresso" : "bg-card border-border"} border rounded-2xl p-6`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs uppercase tracking-widest ${dark ? "text-cream/60" : "text-muted-foreground"}`}>{label}</span>
        <Icon className="w-4 h-4 text-copper" strokeWidth={1.5} />
      </div>
      <div className="font-display text-4xl mt-2">{value}</div>
      {sub && <div className={`text-xs mt-1 ${dark ? "text-cream/60" : "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-display text-lg text-copper" : "font-medium text-espresso"}>{value}</span>
    </div>
  );
}

function isSameDay(value: string, date: Date) {
  const d = new Date(value);
  return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
}

function sumMoney(rows: any[], date?: Date) {
  const filtered = date ? rows.filter((row) => isSameDay(row.delivered_at ?? row.sold_at ?? row.created_at ?? row.spent_at, date)) : rows;
  return filtered.reduce(
    (acc, row) => ({
      usd: acc.usd + Number(row.total_usd ?? row.amount_usd ?? 0),
      fcfa: acc.fcfa + Number(row.total_fcfa ?? row.amount_fcfa ?? 0),
    }),
    { usd: 0, fcfa: 0 },
  );
}

function AdminDashboard() {
  const listExpenses = useServerFn(listStaffExpenses);
  const listWholesale = useServerFn(listWholesaleSales);
  const exportReportFn = useServerFn(exportCompanyReport);
  const exportPdfFn = useServerFn(exportCompanyReportPdf);
  const [reportFrom, setReportFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const { data: products } = useQuery({
    queryKey: ["admin-products"], queryFn: async () => (await supabase.from("products").select("id, price_usd, price_fcfa")).data ?? [],
    ...LIVE_STATS_QUERY_OPTIONS,
  });
  const { data: variants } = useQuery({
    queryKey: ["admin-dashboard-variants"],
    queryFn: async () => (await supabase.from("product_variants").select("id, price_usd, price_fcfa")).data ?? [],
    ...LIVE_STATS_QUERY_OPTIONS,
  });
  const { data: pos } = useQuery({
    queryKey: ["admin-pos"], queryFn: async () => (await supabase.from("points_of_sale").select("id, city")).data ?? [],
    ...LIVE_STATS_QUERY_OPTIONS,
  });
  const { data: stock } = useQuery({
    queryKey: ["admin-low-stock"], queryFn: async () => (await supabase.from("stock").select("*")).data ?? [],
    ...LIVE_STATS_QUERY_OPTIONS,
  });
  const { data: orders } = useQuery({
    queryKey: ["admin-dashboard-orders"],
    queryFn: async () => (await supabase.from("orders").select("*").order("created_at", { ascending: false })).data ?? [],
    ...LIVE_STATS_QUERY_OPTIONS,
  });
  const { data: reviews } = useQuery({
    queryKey: ["admin-dashboard-reviews"],
    queryFn: async () => (await supabase.from("reviews").select("id, approved")).data ?? [],
    ...LIVE_STATS_QUERY_OPTIONS,
  });
  const { data: sales } = useQuery({
    queryKey: ["admin-dashboard-pos-sales"],
    queryFn: async () => {
      const { data } = await supabase.from("pos_sales").select("total_fcfa,total_usd,created_at,pos_id");
      return data ?? [];
    },
    ...LIVE_STATS_QUERY_OPTIONS,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["admin-dashboard-expenses"],
    queryFn: () => listExpenses({}),
    ...LIVE_STATS_QUERY_OPTIONS,
  });
  const { data: wholesaleSales = [] } = useQuery({
    queryKey: ["admin-dashboard-wholesale"],
    queryFn: () => listWholesale({}),
    ...LIVE_STATS_QUERY_OPTIONS,
  });

  const posScopeById = Object.fromEntries((pos ?? []).map((p: any) => [p.id, directionFromCity(p.city)]));
  const salesWithScope = (sales ?? []).map((sale: any) => ({ ...sale, city_scope: posScopeById[sale.pos_id] ?? null }));
  const lowStock = (stock ?? []).filter((s: any) => s.quantity <= s.low_stock_threshold).length;
  const ordersWithScope = (orders ?? []).map((o: any) => ({
    ...o,
    city_scope: o.city_scope ?? directionFromCity(o.city, o.country_code),
  }));
  const deliveredOrders = ordersWithScope.filter((o: any) => o.status === "delivered");
  const revenueRows = [...deliveredOrders, ...salesWithScope, ...wholesaleSales];
  const revenue = sumMoney(revenueRows);
  const deliveredRevenue = sumMoney(deliveredOrders);
  const posRevenue = sumMoney(salesWithScope);
  const wholesaleRevenue = sumMoney(wholesaleSales);
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const todayRevenue = sumMoney(revenueRows, today);
  const sevenDaysAgoRevenue = sumMoney(revenueRows, sevenDaysAgo);
  const expenseTotal = sumMoney(expenses);
  const todayExpenses = sumMoney(expenses, today);
  const pendingReviews = (reviews ?? []).filter((r: any) => !r.approved).length;
  const pendingOrders = (orders ?? []).filter((o: any) => !["delivered", "cancelled"].includes(o.status)).length;
  const byRegion = ADMIN_REPORT_REGIONS.map((region) => {
    const scopedDelivered = sumMoney(deliveredOrders.filter((row: any) => region.scopes.includes(row.city_scope)));
    const scopedPos = sumMoney(salesWithScope.filter((row: any) => region.scopes.includes(row.city_scope)));
    const scopedWholesale = sumMoney(wholesaleSales.filter((row: any) => region.scopes.includes(row.city_scope)));
    const scopedRevenue = {
      usd: scopedDelivered.usd + scopedPos.usd + scopedWholesale.usd,
      fcfa: scopedDelivered.fcfa + scopedPos.fcfa + scopedWholesale.fcfa,
    };
    const scopedExpenses = sumMoney(expenses.filter((row: any) => region.scopes.includes(row.city_scope)));
    return {
      region,
      delivered: scopedDelivered,
      pos: scopedPos,
      wholesale: scopedWholesale,
      revenue: scopedRevenue,
      expenses: scopedExpenses,
      net: {
        usd: scopedRevenue.usd - scopedExpenses.usd,
        fcfa: scopedRevenue.fcfa - scopedExpenses.fcfa,
      },
      orders: deliveredOrders.filter((row: any) => region.scopes.includes(row.city_scope)).length,
    };
  });

  const posStockValue = useMemo(() => {
    const variantById = Object.fromEntries((variants ?? []).map((v: any) => [v.id, v]));
    return (stock ?? []).reduce((sum: { usd: number; fcfa: number }, row: any) => {
      const variant = variantById[row.variant_id];
      const product = (products ?? []).find((p: any) => p.id === row.product_id);
      const priceUsd = variant?.price_usd ?? product?.price_usd ?? 0;
      const priceFcfa = variant?.price_fcfa ?? product?.price_fcfa ?? 0;
      return {
        usd: sum.usd + Number(priceUsd) * Number(row.quantity ?? 0),
        fcfa: sum.fcfa + Number(priceFcfa) * Number(row.quantity ?? 0),
      };
    }, { usd: 0, fcfa: 0 });
  }, [stock, products, variants]);

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
    <StaffShell title="Administration" requiredRole="admin">
      <span className="eyebrow">Vue d'ensemble</span>
      <div className="flex flex-wrap items-end justify-between gap-4 mt-2">
        <h1 className="font-display text-4xl">Tableau de bord entreprise</h1>
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <Stat icon={DollarSign} label="Recette aujourd'hui" value={`$${todayRevenue.usd.toFixed(2)}`} sub={`${todayRevenue.fcfa.toLocaleString("fr-FR")} FCFA`} dark />
        <Stat icon={DollarSign} label="Recette il y a 7 jours" value={`$${sevenDaysAgoRevenue.usd.toFixed(2)}`} sub={`${sevenDaysAgoRevenue.fcfa.toLocaleString("fr-FR")} FCFA`} />
        <Stat icon={DollarSign} label="Dépenses aujourd'hui" value={`$${todayExpenses.usd.toFixed(2)}`} sub={`${todayExpenses.fcfa.toLocaleString("fr-FR")} FCFA`} />
        <Stat icon={TrendingUp} label="Net global" value={`$${(revenue.usd - expenseTotal.usd).toFixed(2)}`} sub={`${(revenue.fcfa - expenseTotal.fcfa).toLocaleString("fr-FR")} FCFA`} dark />
        <Stat icon={ClipboardList} label="CA commandes livrées" value={`$${deliveredRevenue.usd.toFixed(2)}`} sub={`${deliveredRevenue.fcfa.toLocaleString("fr-FR")} FCFA`} />
        <Stat icon={ShoppingCart} label="CA ventes POS" value={`$${posRevenue.usd.toFixed(2)}`} sub={`${posRevenue.fcfa.toLocaleString("fr-FR")} FCFA`} />
        <Stat icon={HandCoins} label="CA ventes en gros" value={`$${wholesaleRevenue.usd.toFixed(2)}`} sub={`${wholesaleRevenue.fcfa.toLocaleString("fr-FR")} FCFA`} />
        <Stat icon={Package} label="Valeur stock POS" value={`$${posStockValue.usd.toFixed(2)}`} sub={`${posStockValue.fcfa.toLocaleString("fr-FR")} FCFA`} />
        <Stat icon={Package} label="Produits" value={products?.length ?? 0} />
        <Stat icon={Store} label="Points de vente" value={pos?.length ?? 0} />
        <Stat icon={ClipboardList} label="Commandes en cours" value={pendingOrders} sub={`${orders?.length ?? 0} au total`} />
        <Stat icon={AlertTriangle} label="Alertes stock" value={lowStock} />
        <Stat icon={MessageSquare} label="Avis à valider" value={pendingReviews} />
        <Stat icon={ShoppingCart} label="Ventes POS" value={sales?.length ?? 0} />
        <Stat icon={ShoppingCart} label="Ventes en gros" value={wholesaleSales.length} />
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">Comptabilité</div>
            <h2 className="font-display text-2xl">CA, dépenses et net par région</h2>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            Produits uniquement — frais de livraison non comptabilisés
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {byRegion.map((row) => (
            <div key={row.region.key} className="rounded-2xl border border-border bg-cream/70 p-5">
              <h3 className="font-display text-xl">{row.region.label}</h3>
              <div className="mt-4 space-y-3 text-sm">
                <Line label="Commandes livrées" value={formatRegionMoney(row.delivered, row.region)} />
                <Line label="Ventes POS" value={formatRegionMoney(row.pos, row.region)} />
                <Line label="Ventes en gros" value={formatRegionMoney(row.wholesale, row.region)} />
                <Line label="Recettes totales" value={formatRegionMoney(row.revenue, row.region)} />
                <Line label="Dépenses" value={formatRegionMoney(row.expenses, row.region)} />
                <Line label="CA net" value={formatRegionMoney(row.net, row.region)} strong />
                <Line label="Nb commandes livrées" value={row.orders} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display text-2xl">Dernières commandes</h2>
          <div className="mt-5 space-y-3">
            {(orders ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune commande pour le moment.</p>
            ) : (
              ordersWithScope.slice(0, 6).map((o: any) => (
                <div key={o.id} className="flex items-center justify-between gap-4 rounded-xl bg-cream/60 p-3">
                  <div>
                    <div className="font-medium text-espresso">{o.order_number}</div>
                    <div className="text-xs text-muted-foreground">{o.customer_name} · {o.city}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg text-copper">{formatOrderAmount(o)}</div>
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
            Surveillez les commandes, les ventes POS, les dépenses, le stock bas et les avis en attente depuis un seul écran.
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
