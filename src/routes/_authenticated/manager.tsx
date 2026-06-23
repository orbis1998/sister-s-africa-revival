import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StaffShell } from "@/components/admin/AdminLayout";
import { createStaffExpense, createWholesaleSale, listStaffExpenses, listWholesaleSales } from "@/lib/finance.functions";
import { listCommuneDeliveryFees, upsertCommuneDeliveryFees } from "@/lib/delivery.functions";
import { directionLabel, formatScopedMoney, directionDeliveryCurrency, directionCurrency } from "@/lib/staff-scope";
import { formatVariantLabel } from "@/lib/product-variants";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/manager")({
  component: ManagerDashboard,
});

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
  const { data: profile } = useQuery({
    queryKey: ["manager-profile", user?.id],
    queryFn: async () => user ? (await supabase.from("profiles").select("city_scope").eq("id", user.id).maybeSingle()).data : null,
    enabled: !!user,
  });
  const { data: managerPerms } = useQuery({
    queryKey: ["manager-perms", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("manager_permissions").select("*").eq("user_id", user!.id).maybeSingle()).data,
  });

  const canViewAccounting = !!managerPerms?.can_view_accounting;
  const canWholesale = !!(canViewAccounting && managerPerms?.can_record_wholesale);
  const canExpenses = !!(canViewAccounting && managerPerms?.can_record_expenses);
  const canPos = !!managerPerms?.can_manage_pos;
  const posIds = (managerPerms?.pos_ids ?? []) as string[];
  const priceCurrency = directionCurrency(profile?.city_scope);

  const { data: expenses = [] } = useQuery({
    queryKey: ["manager-expenses"],
    queryFn: () => listExpenses({}),
    enabled: canExpenses,
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
  const { data: posStock = [] } = useQuery({
    queryKey: ["manager-pos-stock", activePosId],
    enabled: canWholesale && !!activePosId,
    queryFn: async () => (await supabase.from("stock").select("variant_id,quantity").eq("pos_id", activePosId)).data ?? [],
  });
  const { data: wholesaleSales = [] } = useQuery({
    queryKey: ["manager-wholesale-sales"],
    queryFn: () => listWholesale({}),
    enabled: canWholesale,
  });
  const { data: posSales = [] } = useQuery({
    queryKey: ["manager-pos-sales", posIds.join(",")],
    enabled: canViewAccounting && posIds.length > 0,
    queryFn: async () => (await supabase.from("pos_sales").select("*").in("pos_id", posIds).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const { data: deliveryFees = [], refetch: refetchFees } = useQuery({
    queryKey: ["manager-delivery-fees", profile?.city_scope],
    enabled: !!profile?.city_scope,
    queryFn: () => listFees({ data: { city_scope: profile!.city_scope! } }),
  });
  const [feeDraft, setFeeDraft] = useState<Record<string, { local: string }>>({});
  const deliveryCurrency = directionDeliveryCurrency(profile?.city_scope);

  const productVariants = useMemo(() => {
    if (!wholesale.product_id) return [];
    const rows = variants.filter((v: any) => v.product_id === wholesale.product_id);
    return rows.length ? rows : [];
  }, [wholesale.product_id, variants]);
  const selectedVariant = productVariants.find((v: any) => v.id === wholesale.variant_id) ?? productVariants[0];
  const availableStock = useMemo(() => {
    if (!selectedVariant || !activePosId) return 0;
    const row = posStock.find((s: any) => s.variant_id === selectedVariant.id);
    return Number(row?.quantity ?? 0);
  }, [selectedVariant, activePosId, posStock]);

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
    onError: (e: any) => toast.error(e.message),
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
  const wholesaleMut = useMutation({
    mutationFn: () => {
      const selected = products.find((p: any) => p.id === wholesale.product_id);
      const qty = Number.parseInt(wholesale.quantity || "1", 10);
      return createWholesale({
        data: {
          pos_id: activePosId || null,
          customer_name: wholesale.customer_name,
          customer_phone: wholesale.customer_phone,
          product_id: wholesale.product_id || null,
          variant_id: selectedVariant?.id || null,
          product_name: selected?.name ?? wholesale.product_name,
          quantity: qty,
          unit_price_usd: Number(wholesale.unit_price_usd || 0),
          unit_price_fcfa: Number.parseInt(wholesale.unit_price_fcfa || "0", 10),
          payment_status: wholesale.payment_status,
          notes: wholesale.notes,
        },
      });
    },
    onSuccess: () => {
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
      qc.invalidateQueries({ queryKey: ["manager-wholesale-sales"] });
    },
    onError: (e: any) => toast.error(e.message),
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

  const statCards: { label: string; value: string | number }[] = [];
  if (canViewAccounting) {
    statCards.push(
      { label: "Ventes POS du mois", value: formatScopedMoney({ total_usd: monthPosSales.usd, total_fcfa: monthPosSales.fcfa }, profile?.city_scope) },
      { label: "Ventes POS", value: posSales.length },
    );
  }
  if (canWholesale) {
    statCards.push(
      { label: "Ventes en gros du mois", value: formatScopedMoney({ total_usd: monthWholesale.usd, total_fcfa: monthWholesale.fcfa }, profile?.city_scope) },
      { label: "Nombre ventes en gros", value: wholesaleSales.length },
    );
  }
  if (canExpenses) {
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

      {statCards.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-border bg-card p-6">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{card.label}</div>
              <div className="font-display text-4xl mt-2">{card.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Aucun module comptable activé. L'administrateur peut activer la comptabilité, le POS, les dépenses ou la vente en gros depuis Utilisateurs.
        </div>
      )}

      {canViewAccounting && posSales.length > 0 && (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl">Dernières ventes POS</h2>
          <div className="mt-5 space-y-3">
            {posSales.slice(0, 8).map((item: any) => (
              <div key={item.id} className="rounded-xl bg-cream/70 p-3 text-sm flex items-center justify-between gap-3">
                <span>{item.customer_name || "Client comptoir"}</span>
                <span className="font-medium text-copper">{formatScopedMoney({ total_usd: item.total_usd, total_fcfa: item.total_fcfa }, profile?.city_scope)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Frais de livraison Kinshasa</h2>
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

      {canWholesale && (
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl">Vente en gros</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Prix en <strong>{priceCurrency}</strong>. Les ventes en gros n&apos;impactent pas le stock POS.
          </p>
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
              disabled={wholesaleMut.isPending || !wholesale.customer_name.trim() || !wholesale.product_id}
              onClick={() => wholesaleMut.mutate()}
              className="btn-hero disabled:opacity-50"
            >
              {wholesaleMut.isPending ? "Enregistrement..." : "Enregistrer la vente en gros"}
            </button>
          </div>
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
                  <span className="font-medium text-copper">{formatScopedMoney({ total_usd: item.total_usd, total_fcfa: item.total_fcfa }, item.city_scope)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {canExpenses && (
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl">Signaler une dépense</h2>
          <div className="mt-5 grid gap-3">
            {priceCurrency === "FCFA" ? (
              <input type="number" min={0} placeholder="Montant FCFA" value={expense.amount_fcfa} onChange={(e) => setExpense({ ...expense, amount_fcfa: e.target.value, amount_usd: "" })} className="input-admin" />
            ) : (
              <input type="number" min={0} step="0.01" placeholder="Montant USD" value={expense.amount_usd} onChange={(e) => setExpense({ ...expense, amount_usd: e.target.value, amount_fcfa: "" })} className="input-admin" />
            )}
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
      )}
    </StaffShell>
  );
}
