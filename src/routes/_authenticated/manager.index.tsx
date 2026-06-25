import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { StaffShell } from "@/components/admin/AdminLayout";
import { createStaffExpense, createWholesaleSale, listStaffExpenses, listWholesaleSales } from "@/lib/finance.functions";
import { listCommuneDeliveryFees, upsertCommuneDeliveryFees } from "@/lib/delivery.functions";
import { getMyManagerPermissions } from "@/lib/permissions.functions";
import { directionLabel, formatScopedMoney, directionDeliveryCurrency, directionCurrency } from "@/lib/staff-scope";
import { supabase } from "@/integrations/supabase/client";
import { formatVariantLabel } from "@/lib/product-variants";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Boxes, ClipboardList, HandCoins, Package, ShoppingCart, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/manager/")({
  component: ManagerDashboard,
});

const MODULE_LINKS = [
  { perm: "can_manage_products" as const, label: "Produits", to: "/admin/products", icon: Package },
  { perm: "can_manage_stock" as const, label: "Stock", to: "/admin/stock", icon: Boxes },
  { perm: "can_manage_orders" as const, label: "Commandes", to: "/admin/logistics", icon: ClipboardList },
  { perm: "can_manage_logistics" as const, label: "Logistique", to: "/admin/logistics", icon: ClipboardList },
  { perm: "can_manage_pos" as const, label: "Caisse POS", to: "/pos", icon: ShoppingCart },
  { perm: "can_record_wholesale" as const, label: "Vente en gros", to: "/manager", icon: HandCoins, anchor: "wholesale" },
  { perm: "can_record_expenses" as const, label: "Dépenses", to: "/manager", icon: Wallet, anchor: "expenses" },
  { perm: "can_view_accounting" as const, label: "Comptabilité générale", to: "/manager/accounting", icon: Wallet },
];

function ManagerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const createExpense = useServerFn(createStaffExpense);
  const listExpenses = useServerFn(listStaffExpenses);
  const createWholesale = useServerFn(createWholesaleSale);
  const listWholesale = useServerFn(listWholesaleSales);
  const listFees = useServerFn(listCommuneDeliveryFees);
  const saveFees = useServerFn(upsertCommuneDeliveryFees);
  const [expense, setExpense] = useState({ amount_usd: "", amount_fcfa: "", note: "" });
  const [wholesale, setWholesale] = useState({
    pos_id: "",
    customer_name: "",
    customer_phone: "",
    product_id: "",
    variant_id: "",
    product_name: "",
    quantity: "1",
    unit_price_usd: "",
    unit_price_fcfa: "",
    payment_status: "pending",
    notes: "",
  });
  const fetchManagerPerms = useServerFn(getMyManagerPermissions);
  const { data: profile } = useQuery({
    queryKey: ["manager-profile", user?.id],
    queryFn: async () => user ? (await supabase.from("profiles").select("city_scope").eq("id", user.id).maybeSingle()).data : null,
    enabled: !!user,
  });
  const { data: managerPerms, isLoading: permsLoading } = useQuery({
    queryKey: ["manager-permissions", user?.id],
    enabled: !!user,
    queryFn: () => fetchManagerPerms({}),
    staleTime: 30_000,
  });

  const canViewAccounting = !!managerPerms?.can_view_accounting;
  const canWholesale = !!managerPerms?.can_record_wholesale;
  const canExpenses = !!managerPerms?.can_record_expenses;
  const canPos = !!managerPerms?.can_manage_pos;
  const canLogistics = !!(managerPerms?.can_manage_logistics || managerPerms?.can_manage_orders);
  const activeModules = useMemo(() => {
    if (!managerPerms) return [];
    const seen = new Set<string>();
    return MODULE_LINKS.filter((mod) => {
      if (!managerPerms[mod.perm]) return false;
      const key = mod.to + (mod.anchor ?? "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [managerPerms]);

  const posIds = (managerPerms?.pos_ids ?? []) as string[];
  const priceCurrency = directionCurrency(profile?.city_scope);

  const { data: expenses = [], refetch: refetchExpenses } = useQuery({
    queryKey: ["manager-expenses", user?.id],
    queryFn: () => listExpenses({}),
    enabled: canExpenses || canViewAccounting,
  });
  const { data: products = [] } = useQuery({
    queryKey: ["manager-products"],
    queryFn: async () => (await supabase.from("products").select("id,name,slug").eq("is_active", true).order("name")).data ?? [],
    enabled: canWholesale,
  });
  const { data: variants = [] } = useQuery({
    queryKey: ["manager-variants"],
    queryFn: async () => (await supabase.from("product_variants").select("*").eq("is_active", true).order("sort_order")).data ?? [],
    enabled: canWholesale,
  });
  const { data: posList = [] } = useQuery({
    queryKey: ["manager-pos-list", posIds.join(",")],
    enabled: canWholesale && posIds.length > 0,
    queryFn: async () => (await supabase.from("points_of_sale").select("id,name,city").in("id", posIds).order("name")).data ?? [],
  });
  const activePosId = wholesale.pos_id || posList[0]?.id || "";
  useEffect(() => {
    if (posList.length && !wholesale.pos_id) {
      setWholesale((prev) => ({ ...prev, pos_id: posList[0].id }));
    }
  }, [posList, wholesale.pos_id]);
  const { data: posStock = [] } = useQuery({
    queryKey: ["manager-pos-stock", activePosId],
    enabled: canWholesale && !!activePosId,
    queryFn: async () => (await supabase.from("stock").select("variant_id,quantity").eq("pos_id", activePosId)).data ?? [],
  });
  const { data: wholesaleSales = [], refetch: refetchWholesale } = useQuery({
    queryKey: ["manager-wholesale-sales", user?.id],
    queryFn: () => listWholesale({}),
    enabled: canWholesale || canViewAccounting,
  });
  const { data: deliveredOrders = [] } = useQuery({
    queryKey: ["manager-delivered-orders", profile?.city_scope],
    enabled: canViewAccounting && !!profile?.city_scope,
    queryFn: async () => (await supabase.from("orders").select("*").eq("status", "delivered").eq("city_scope", profile!.city_scope!).order("delivered_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { data: posSales = [] } = useQuery({
    queryKey: ["manager-pos-sales", posIds.join(",")],
    enabled: canViewAccounting && posIds.length > 0,
    queryFn: async () => (await supabase.from("pos_sales").select("*").in("pos_id", posIds).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const { data: deliveryFees = [], refetch: refetchFees } = useQuery({
    queryKey: ["manager-delivery-fees", profile?.city_scope],
    enabled: canLogistics && !!profile?.city_scope,
    queryFn: () => listFees({ data: { city_scope: profile!.city_scope! } }),
  });
  const [feeDraft, setFeeDraft] = useState<Record<string, { local: string }>>({});
  const deliveryCurrency = directionDeliveryCurrency(profile?.city_scope);

  const productVariants = useMemo(() => {
    if (!wholesale.product_id) return [];
    return variants.filter((v: any) => v.product_id === wholesale.product_id);
  }, [wholesale.product_id, variants]);
  const selectedVariant = productVariants.find((v: any) => v.id === wholesale.variant_id) ?? productVariants[0];

  const feeMut = useMutation({
    mutationFn: () => saveFees({
      data: {
        fees: deliveryFees.map((fee: any) => {
          const raw = feeDraft[fee.id]?.local ?? String(fee.fee_fcfa ?? 0);
          const parsed = Number.parseInt(raw, 10);
          return {
            id: fee.id,
            country_code: fee.country_code,
            city: fee.city,
            commune: fee.commune,
            zone: fee.zone ?? "",
            fee_fcfa: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
            fee_usd: 0,
          };
        }),
      },
    }),
    onSuccess: () => {
      toast.success("Frais de livraison enregistrés");
      refetchFees();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const expenseMut = useMutation({
    mutationFn: () => createExpense({
      data: {
        amount_usd: Number(expense.amount_usd || 0),
        amount_fcfa: Number.parseInt(expense.amount_fcfa || "0", 10) || 0,
        note: expense.note.trim(),
      },
    }),
    onSuccess: async () => {
      toast.success("Dépense signalée");
      setExpense({ amount_usd: "", amount_fcfa: "", note: "" });
      await refetchExpenses();
      qc.invalidateQueries({ queryKey: ["manager-accounting-expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const wholesaleMut = useMutation({
    mutationFn: () => {
      const selected = products.find((p: any) => p.id === wholesale.product_id);
      const qty = Number.parseInt(wholesale.quantity || "1", 10);
      if (!activePosId) throw new Error("Aucun point de vente assigné — contactez l'administrateur");
      if (!selected?.name && !wholesale.product_name.trim()) throw new Error("Produit requis");
      return createWholesale({
        data: {
          pos_id: activePosId,
          customer_name: wholesale.customer_name.trim(),
          customer_phone: wholesale.customer_phone.trim() || undefined,
          product_id: wholesale.product_id || null,
          variant_id: selectedVariant?.id || null,
          product_name: selected?.name ?? wholesale.product_name.trim(),
          quantity: Number.isNaN(qty) ? 1 : Math.max(1, qty),
          unit_price_usd: Number(wholesale.unit_price_usd || 0),
          unit_price_fcfa: Number.parseInt(wholesale.unit_price_fcfa || "0", 10) || 0,
          payment_status: wholesale.payment_status,
          notes: wholesale.notes.trim() || undefined,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Vente en gros enregistrée");
      setWholesale({
        pos_id: activePosId,
        customer_name: "",
        customer_phone: "",
        product_id: "",
        variant_id: "",
        product_name: "",
        quantity: "1",
        unit_price_usd: "",
        unit_price_fcfa: "",
        payment_status: "pending",
        notes: "",
      });
      await refetchWholesale();
      qc.invalidateQueries({ queryKey: ["manager-pos-stock"] });
      qc.invalidateQueries({ queryKey: ["wholesale-sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const monthExpenses = expenses.reduce((sum: { usd: number; fcfa: number }, item: any) => {
    const d = new Date(item.spent_at);
    const now = new Date();
    if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return sum;
    return { usd: sum.usd + Number(item.amount_usd ?? 0), fcfa: sum.fcfa + Number(item.amount_fcfa ?? 0) };
  }, { usd: 0, fcfa: 0 });
  const monthWholesale = wholesaleSales.reduce((sum: { usd: number; fcfa: number }, item: any) => {
    const d = new Date(item.sold_at);
    const now = new Date();
    if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return sum;
    return { usd: sum.usd + Number(item.total_usd ?? 0), fcfa: sum.fcfa + Number(item.total_fcfa ?? 0) };
  }, { usd: 0, fcfa: 0 });
  const monthPosSales = posSales.reduce((sum: { usd: number; fcfa: number }, item: any) => {
    const d = new Date(item.created_at);
    const now = new Date();
    if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return sum;
    return { usd: sum.usd + Number(item.total_usd ?? 0), fcfa: sum.fcfa + Number(item.total_fcfa ?? 0) };
  }, { usd: 0, fcfa: 0 });
  const monthDelivered = deliveredOrders.reduce((sum: { usd: number; fcfa: number }, item: any) => {
    const d = new Date(item.delivered_at ?? item.created_at);
    const now = new Date();
    if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return sum;
    return { usd: sum.usd + Number(item.total_usd ?? 0), fcfa: sum.fcfa + Number(item.total_fcfa ?? 0) };
  }, { usd: 0, fcfa: 0 });
  const monthNet = {
    usd: monthPosSales.usd + monthWholesale.usd + monthDelivered.usd - monthExpenses.usd,
    fcfa: monthPosSales.fcfa + monthWholesale.fcfa + monthDelivered.fcfa - monthExpenses.fcfa,
  };

  const statCards: { label: string; value: string | number }[] = [];
  if (canViewAccounting) {
    statCards.push({ label: "CA net du mois", value: formatScopedMoney({ total_usd: monthNet.usd, total_fcfa: monthNet.fcfa }, profile?.city_scope) });
  }
  if (canWholesale || canViewAccounting) {
    statCards.push(
      { label: "Ventes en gros du mois", value: formatScopedMoney({ total_usd: monthWholesale.usd, total_fcfa: monthWholesale.fcfa }, profile?.city_scope) },
      { label: "Nombre ventes en gros", value: wholesaleSales.length },
    );
  }
  if (canExpenses || canViewAccounting) {
    statCards.push(
      { label: "Dépenses du mois", value: formatScopedMoney({ total_usd: monthExpenses.usd, total_fcfa: monthExpenses.fcfa }, profile?.city_scope) },
      { label: "Dépenses signalées", value: expenses.length },
    );
  }

  return (
    <StaffShell title="Manager" requiredRole="manager">
      <span className="eyebrow">Espace manager</span>
      <h1 className="font-display text-4xl mt-2">Tableau de bord</h1>
      <p className="text-muted-foreground mt-2">
        Direction : <strong>{directionLabel(profile?.city_scope)}</strong>.
      </p>

      {canPos && (
        <Link to="/pos" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-copper/30 bg-copper/10 px-4 py-2 text-sm font-medium text-copper hover:bg-copper/15">
          <ShoppingCart className="h-4 w-4" /> Ouvrir la caisse POS
        </Link>
      )}

      {permsLoading ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Chargement de vos accès…
        </div>
      ) : !managerPerms ? (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
          Aucune permission enregistrée pour ce compte. Demandez à l&apos;administrateur de configurer vos accès depuis Utilisateurs.
        </div>
      ) : activeModules.length > 0 ? (
        <div className="mt-8">
          <h2 className="font-display text-2xl">Vos accès</h2>
          <p className="mt-1 text-sm text-muted-foreground">Modules activés par l&apos;administrateur.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeModules.map((mod) => (
              <Link
                key={mod.label}
                to={mod.to as any}
                hash={mod.anchor}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-copper/40 hover:bg-copper/5"
              >
                <mod.icon className="h-5 w-5 text-copper" strokeWidth={1.5} />
                <span className="font-medium text-espresso">{mod.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Aucun module activé. L&apos;administrateur peut activer vos accès depuis Utilisateurs.
        </div>
      )}

      {statCards.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-border bg-card p-6">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{card.label}</div>
              <div className="font-display text-4xl mt-2">{card.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {canViewAccounting && (
        <Link to="/manager/accounting" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-copper/30 bg-copper/10 px-4 py-3 text-sm font-medium text-copper hover:bg-copper/15">
          <Wallet className="h-4 w-4" /> Ouvrir la comptabilité générale de {directionLabel(profile?.city_scope)}
        </Link>
      )}

      {canLogistics && (
      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Frais de livraison — {directionLabel(profile?.city_scope)}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Fixez le prix de livraison en <strong>{deliveryCurrency}</strong> par commune et quartier/zone.
        </p>
        <div className="mt-5 max-h-[420px] overflow-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-cream text-left text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="p-3">Ville</th>
                <th className="p-3">Commune</th>
                <th className="p-3">Quartier / Zone</th>
                <th className="p-3">Frais livraison ({deliveryCurrency})</th>
              </tr>
            </thead>
            <tbody>
              {deliveryFees.map((fee: any) => (
                <tr key={fee.id} className="border-t border-border">
                  <td className="p-3">{fee.city}</td>
                  <td className="p-3">{fee.commune}</td>
                  <td className="p-3 text-muted-foreground">{fee.zone || "—"}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      min={0}
                      className="input-admin w-36"
                      value={feeDraft[fee.id]?.local ?? String(fee.fee_fcfa ?? 0)}
                      onChange={(e) => setFeeDraft((d) => ({ ...d, [fee.id]: { local: e.target.value } }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button disabled={feeMut.isPending || !deliveryFees.length} onClick={() => feeMut.mutate()} className="btn-hero mt-4 disabled:opacity-50">
          {feeMut.isPending ? "Enregistrement..." : "Enregistrer les frais de livraison"}
        </button>
      </div>
      )}

      {canWholesale && (
      <div id="wholesale" className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl">Vente en gros</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Prix en <strong>{priceCurrency}</strong>. Le stock du point de vente sélectionné sera déduit.
          </p>
          {!posList.length ? (
            <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
              Aucun point de vente assigné. L&apos;administrateur doit vous associer à un POS depuis Utilisateurs.
            </p>
          ) : (
          <div className="mt-5 grid gap-3">
            {posList.length > 1 && (
              <select value={activePosId} onChange={(e) => setWholesale({ ...wholesale, pos_id: e.target.value, variant_id: "" })} className="input-admin">
                {posList.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.city ? ` · ${p.city}` : ""}</option>)}
              </select>
            )}
            <input placeholder="Nom du client / revendeur" value={wholesale.customer_name} onChange={(e) => setWholesale({ ...wholesale, customer_name: e.target.value })} className="input-admin" />
            <input placeholder="Téléphone" value={wholesale.customer_phone} onChange={(e) => setWholesale({ ...wholesale, customer_phone: e.target.value })} className="input-admin" />
            <select value={wholesale.product_id} onChange={(e) => {
              const selected = products.find((p: any) => p.id === e.target.value);
              setWholesale({ ...wholesale, product_id: e.target.value, variant_id: "", product_name: selected?.name ?? "" });
            }} className="input-admin">
              <option value="">Sélectionner un produit</option>
              {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {productVariants.length > 1 && (
              <select value={wholesale.variant_id || selectedVariant?.id || ""} onChange={(e) => setWholesale({ ...wholesale, variant_id: e.target.value })} className="input-admin">
                {productVariants.map((v: any) => (
                  <option key={v.id} value={v.id}>{formatVariantLabel(Number(v.weight_value), v.weight_unit)}</option>
                ))}
              </select>
            )}
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min={1} placeholder="Qté" value={wholesale.quantity} onChange={(e) => setWholesale({ ...wholesale, quantity: e.target.value })} className="input-admin" />
              {priceCurrency === "FCFA" ? (
                <input type="number" min={0} placeholder="Prix unitaire FCFA" value={wholesale.unit_price_fcfa} onChange={(e) => setWholesale({ ...wholesale, unit_price_fcfa: e.target.value, unit_price_usd: "" })} className="input-admin" />
              ) : (
                <input type="number" min={0} step="0.01" placeholder="Prix unitaire USD" value={wholesale.unit_price_usd} onChange={(e) => setWholesale({ ...wholesale, unit_price_usd: e.target.value, unit_price_fcfa: "" })} className="input-admin" />
              )}
            </div>
            <select value={wholesale.payment_status} onChange={(e) => setWholesale({ ...wholesale, payment_status: e.target.value })} className="input-admin">
              <option value="pending">En attente</option>
              <option value="paid">Payée</option>
              <option value="partial">Partielle</option>
              <option value="cancelled">Annulée</option>
            </select>
            <textarea placeholder="Détails / notes" value={wholesale.notes} onChange={(e) => setWholesale({ ...wholesale, notes: e.target.value })} className="input-admin resize-none" rows={3} />
            <button
              type="button"
              disabled={wholesaleMut.isPending || !wholesale.customer_name.trim() || !wholesale.product_id || !activePosId}
              onClick={() => wholesaleMut.mutate()}
              className="btn-hero disabled:opacity-50"
            >
              {wholesaleMut.isPending ? "Enregistrement..." : "Enregistrer la vente en gros"}
            </button>
          </div>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl">Dernières ventes en gros</h2>
          <div className="mt-5 space-y-3">
            {wholesaleSales.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente en gros.</p>
            ) : wholesaleSales.slice(0, 8).map((item: any) => (
              <div key={item.id} className="rounded-xl bg-cream/70 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <strong>{item.product_name} × {item.quantity}</strong>
                  <span className="text-xs text-muted-foreground">{new Date(item.sold_at).toLocaleDateString("fr-FR")}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{item.customer_name}</span>
                  <span className="font-medium text-copper">{formatScopedMoney({ total_usd: item.total_usd, total_fcfa: item.total_fcfa }, item.city_scope ?? profile?.city_scope)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {canExpenses && (
      <div id="expenses" className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl">Signaler une dépense</h2>
          <div className="mt-5 grid gap-3">
            {priceCurrency === "FCFA" ? (
              <input type="number" min={0} placeholder="Montant FCFA" value={expense.amount_fcfa} onChange={(e) => setExpense({ ...expense, amount_fcfa: e.target.value, amount_usd: "" })} className="input-admin" />
            ) : (
              <input type="number" min={0} step="0.01" placeholder="Montant USD" value={expense.amount_usd} onChange={(e) => setExpense({ ...expense, amount_usd: e.target.value, amount_fcfa: "" })} className="input-admin" />
            )}
            <textarea placeholder="Note / justification" value={expense.note} onChange={(e) => setExpense({ ...expense, note: e.target.value })} className="input-admin resize-none" rows={4} />
            <button type="button" disabled={expenseMut.isPending || !expense.note.trim()} onClick={() => expenseMut.mutate()} className="btn-hero disabled:opacity-50">
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
                  <strong>{formatScopedMoney({ total_usd: item.amount_usd, total_fcfa: item.amount_fcfa }, item.city_scope ?? profile?.city_scope)}</strong>
                  <span className="text-xs text-muted-foreground">{new Date(item.spent_at).toLocaleDateString("fr-FR")}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </StaffShell>
  );
}
