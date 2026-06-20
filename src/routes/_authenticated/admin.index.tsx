import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell } from "@/components/admin/AdminLayout";
import { listStaffExpenses, listWholesaleSales } from "@/lib/finance.functions";
import { directionFromCity, directionLabel, formatScopedMoney, STAFF_DIRECTIONS } from "@/lib/staff-scope";
import { AlertTriangle, ClipboardList, DollarSign, MessageSquare, Package, ShoppingCart, Store } from "lucide-react";

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
  const { data: products } = useQuery({
    queryKey: ["admin-products"], queryFn: async () => (await supabase.from("products").select("id")).data ?? [],
  });
  const { data: pos } = useQuery({
    queryKey: ["admin-pos"], queryFn: async () => (await supabase.from("points_of_sale").select("id, city")).data ?? [],
  });
  const { data: stock } = useQuery({
    queryKey: ["admin-low-stock"], queryFn: async () => (await supabase.from("stock").select("*")).data ?? [],
  });
  const { data: orders } = useQuery({
    queryKey: ["admin-dashboard-orders"],
    queryFn: async () => (await supabase.from("orders").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: reviews } = useQuery({
    queryKey: ["admin-dashboard-reviews"],
    queryFn: async () => (await supabase.from("reviews").select("id, approved")).data ?? [],
  });
  const { data: sales } = useQuery({
    queryKey: ["admin-dashboard-pos-sales"],
    queryFn: async () => {
      const { data } = await supabase.from("pos_sales").select("total_fcfa,total_usd,created_at,pos_id");
      return data ?? [];
    },
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["admin-dashboard-expenses"],
    queryFn: () => listExpenses({}),
  });
  const { data: wholesaleSales = [] } = useQuery({
    queryKey: ["admin-dashboard-wholesale"],
    queryFn: () => listWholesale({}),
  });

  const posScopeById = Object.fromEntries((pos ?? []).map((p: any) => [p.id, directionFromCity(p.city)]));
  const salesWithScope = (sales ?? []).map((sale: any) => ({ ...sale, city_scope: posScopeById[sale.pos_id] ?? null }));
  const lowStock = (stock ?? []).filter((s: any) => s.quantity <= s.low_stock_threshold).length;
  const deliveredOrders = (orders ?? []).filter((o: any) => o.status === "delivered");
  const revenueRows = [...deliveredOrders, ...salesWithScope, ...wholesaleSales];
  const revenue = sumMoney(revenueRows);
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const todayRevenue = sumMoney(revenueRows, today);
  const sevenDaysAgoRevenue = sumMoney(revenueRows, sevenDaysAgo);
  const expenseTotal = sumMoney(expenses);
  const todayExpenses = sumMoney(expenses, today);
  const pendingReviews = (reviews ?? []).filter((r: any) => !r.approved).length;
  const byDirection = STAFF_DIRECTIONS.map((direction) => {
    const scopedRevenue = sumMoney(revenueRows.filter((row: any) => row.city_scope === direction.value));
    const scopedExpenses = sumMoney(expenses.filter((row: any) => row.city_scope === direction.value));
    return {
      direction,
      revenue: scopedRevenue,
      expenses: scopedExpenses,
      net: {
        usd: scopedRevenue.usd - scopedExpenses.usd,
        fcfa: scopedRevenue.fcfa - scopedExpenses.fcfa,
      },
      orders: deliveredOrders.filter((row: any) => row.city_scope === direction.value).length,
    };
  });

  return (
    <StaffShell title="Administration" requiredRole="admin">
      <span className="eyebrow">Vue d'ensemble</span>
      <h1 className="font-display text-4xl mt-2">Tableau de bord entreprise</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <Stat icon={DollarSign} label="Recette aujourd'hui" value={`$${todayRevenue.usd.toFixed(2)}`} sub={`${todayRevenue.fcfa.toLocaleString("fr-FR")} FCFA`} dark />
        <Stat icon={DollarSign} label="Recette il y a 7 jours" value={`$${sevenDaysAgoRevenue.usd.toFixed(2)}`} sub={`${sevenDaysAgoRevenue.fcfa.toLocaleString("fr-FR")} FCFA`} />
        <Stat icon={DollarSign} label="Dépenses aujourd'hui" value={`$${todayExpenses.usd.toFixed(2)}`} sub={`${todayExpenses.fcfa.toLocaleString("fr-FR")} FCFA`} />
        <Stat icon={DollarSign} label="Net global" value={`$${(revenue.usd - expenseTotal.usd).toFixed(2)}`} sub={`${(revenue.fcfa - expenseTotal.fcfa).toLocaleString("fr-FR")} FCFA`} dark />
        <Stat icon={Package} label="Produits" value={products?.length ?? 0} />
        <Stat icon={Store} label="Points de vente" value={pos?.length ?? 0} />
        <Stat icon={ClipboardList} label="Commandes" value={orders?.length ?? 0} sub="Toutes les commandes" />
        <Stat icon={AlertTriangle} label="Alertes stock" value={lowStock} />
        <Stat icon={MessageSquare} label="Avis à valider" value={pendingReviews} />
        <Stat icon={ShoppingCart} label="Ventes POS" value={sales?.length ?? 0} />
        <Stat icon={ShoppingCart} label="Ventes en gros" value={wholesaleSales.length} />
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">Directions</div>
            <h2 className="font-display text-2xl">CA, dépenses et net par ville</h2>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            CA basé sur commandes livrées + ventes POS
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {byDirection.map((row) => (
            <div key={row.direction.value} className="rounded-2xl border border-border bg-cream/70 p-5">
              <h3 className="font-display text-xl">{row.direction.label}</h3>
              <div className="mt-4 space-y-3 text-sm">
                <Line label="CA" value={formatScopedMoney({ total_usd: row.revenue.usd, total_fcfa: row.revenue.fcfa }, row.direction.value)} />
                <Line label="Dépenses" value={formatScopedMoney({ total_usd: row.expenses.usd, total_fcfa: row.expenses.fcfa }, row.direction.value)} />
                <Line label="Net" value={formatScopedMoney({ total_usd: row.net.usd, total_fcfa: row.net.fcfa }, row.direction.value)} strong />
                <Line label="Commandes livrées" value={row.orders} />
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
