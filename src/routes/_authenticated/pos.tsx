import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { StaffShell } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { createPosSale } from "@/lib/pos.functions";
import { formatVariantLabel } from "@/lib/product-variants";
import { directionCurrency, formatScopedMoney } from "@/lib/staff-scope";

export const Route = createFileRoute("/_authenticated/pos")({
  component: PosDashboard,
});

function PosDashboard() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const createSaleFn = useServerFn(createPosSale);
  const [selectedPosId, setSelectedPosId] = useState("");
  const [sale, setSale] = useState<any>({
    customer_name: "",
    customer_phone: "",
    product_id: "",
    variant_id: "",
    qty: "",
    payment_method: "cash",
    items: [],
  });

  const assignment = useQuery({
    queryKey: ["pos-assignment", user?.id, roles.join(",")],
    enabled: !!user,
    queryFn: async () => {
      const { data: posAccount } = await supabase
        .from("pos_accounts")
        .select("pos_id, points_of_sale(name, city, address, city_scope)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (posAccount?.pos_id) return { pos_id: posAccount.pos_id, points_of_sale: posAccount.points_of_sale, managerPosList: null as any[] | null };

      if (roles.includes("manager")) {
        const { data: perms } = await supabase
          .from("manager_permissions")
          .select("can_manage_pos, pos_ids")
          .eq("user_id", user!.id)
          .maybeSingle();
        const ids = ((perms?.pos_ids ?? []) as string[]).filter(Boolean);
        if (!perms?.can_manage_pos || !ids.length) return null;
        const { data: posRows } = await supabase
          .from("points_of_sale")
          .select("id, name, city, address, city_scope")
          .in("id", ids)
          .order("name");
        const first = posRows?.[0];
        return {
          pos_id: first?.id ?? null,
          points_of_sale: first ?? null,
          managerPosList: posRows ?? [],
        };
      }
      return posAccount;
    },
  });

  const activePosId = selectedPosId || assignment.data?.pos_id || "";
  const activePos = useMemo(() => {
    if (assignment.data?.managerPosList?.length) {
      return assignment.data.managerPosList.find((p: any) => p.id === activePosId) ?? assignment.data.managerPosList[0];
    }
    return assignment.data?.points_of_sale;
  }, [assignment.data, activePosId]);
  const priceCurrency = directionCurrency(activePos?.city_scope);

  const products = useQuery({
    queryKey: ["pos-products"],
    queryFn: async () => (await supabase.from("products").select("*").eq("is_active", true).order("name")).data ?? [],
  });

  const variants = useQuery({
    queryKey: ["pos-variants"],
    queryFn: async () => (await supabase.from("product_variants").select("*").eq("is_active", true).order("sort_order")).data ?? [],
  });

  const stock = useQuery({
    queryKey: ["pos-stock", activePosId],
    enabled: !!activePosId,
    queryFn: async () => (await supabase.from("stock").select("*").eq("pos_id", activePosId)).data ?? [],
  });

  const sales = useQuery({
    queryKey: ["pos-sales", activePosId],
    enabled: !!activePosId,
    queryFn: async () => (await supabase.from("pos_sales").select("*").eq("pos_id", activePosId).order("created_at", { ascending: false })).data ?? [],
  });

  const selectedProduct = products.data?.find((p: any) => p.id === sale.product_id);
  const productVariants = useMemo(() => {
    if (!selectedProduct) return [];
    const rows = (variants.data ?? []).filter((v: any) => v.product_id === selectedProduct.id);
    if (rows.length) return rows;
    return [{
      id: selectedProduct.id,
      product_id: selectedProduct.id,
      weight_value: 1,
      weight_unit: "kg",
      price_usd: selectedProduct.price_usd,
      price_fcfa: selectedProduct.price_fcfa,
    }];
  }, [selectedProduct, variants.data]);
  const selectedVariant = productVariants.find((v: any) => v.id === sale.variant_id) ?? productVariants[0];
  const availableQty = useMemo(() => {
    if (!selectedVariant || !activePosId) return 0;
    const row = (stock.data ?? []).find((s: any) => s.variant_id === selectedVariant.id);
    return row?.quantity ?? 0;
  }, [selectedVariant, activePosId, stock.data]);
  const totalFcfa = sale.items.reduce((sum: number, item: any) => sum + Number(item.price_fcfa ?? 0) * Number(item.qty ?? 1), 0);
  const totalUsd = sale.items.reduce((sum: number, item: any) => sum + Number(item.price_usd ?? 0) * Number(item.qty ?? 1), 0);

  const todaySales = useMemo(() => {
    const today = new Date().toDateString();
    return (sales.data ?? []).filter((s: any) => new Date(s.created_at).toDateString() === today);
  }, [sales.data]);
  const todayRevenue = todaySales.reduce(
    (acc: { usd: number; fcfa: number }, s: any) => ({
      usd: acc.usd + Number(s.total_usd ?? 0),
      fcfa: acc.fcfa + Number(s.total_fcfa ?? 0),
    }),
    { usd: 0, fcfa: 0 },
  );

  const formatItemTotal = (item: any) =>
    formatScopedMoney(
      { total_usd: Number(item.price_usd ?? 0) * item.qty, total_fcfa: Number(item.price_fcfa ?? 0) * item.qty },
      activePos?.city_scope,
    );

  const createSale = useMutation({
    mutationFn: async () => {
      if (!user || !activePosId || sale.items.length === 0) throw new Error("Vente incomplète");
      return createSaleFn({
        data: {
          pos_id: activePosId,
          customer_name: sale.customer_name || undefined,
          customer_phone: sale.customer_phone || undefined,
          payment_method: sale.payment_method,
          total_fcfa: totalFcfa,
          total_usd: totalUsd,
          items: sale.items,
        },
      });
    },
    onSuccess: () => {
      toast.success("Vente enregistrée — stock mis à jour");
      setSale({ customer_name: "", customer_phone: "", product_id: "", variant_id: "", qty: "", payment_method: "cash", items: [] });
      qc.invalidateQueries({ queryKey: ["pos-sales", activePosId] });
      qc.invalidateQueries({ queryKey: ["pos-stock", activePosId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <StaffShell title="Point de vente" requiredRole={["pos", "manager"]} requiredPermission="can_manage_pos">
      <span className="eyebrow">Caisse POS</span>
      {assignment.data?.managerPosList && assignment.data.managerPosList.length > 1 && (
        <select
          value={activePosId}
          onChange={(e) => setSelectedPosId(e.target.value)}
          className="input-admin mt-4 max-w-md"
        >
          {assignment.data.managerPosList.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}{p.city ? ` · ${p.city}` : ""}</option>
          ))}
        </select>
      )}
      <h1 className="font-display text-4xl mt-2">{activePos?.name ?? "Point de vente"}</h1>
      <p className="text-sm text-muted-foreground mt-1">{activePos?.city}</p>

      {assignment.isLoading ? (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</div>
      ) : !activePosId ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
          Aucun point de vente n'est associé à ce compte.
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Stat label="Ventes du jour" value={todaySales.length} />
            <Stat label="CA journalier" value={formatScopedMoney(todayRevenue, activePos?.city_scope)} />
            <Stat label="Variantes en stock" value={stock.data?.filter((s: any) => s.quantity > 0).length ?? 0} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-2xl">Nouvelle vente</h2>
              <div className="mt-5 grid gap-3">
                <input placeholder="Nom client (optionnel)" value={sale.customer_name} onChange={(e) => setSale({ ...sale, customer_name: e.target.value })} className="input-admin" />
                <input placeholder="Téléphone client (optionnel)" value={sale.customer_phone} onChange={(e) => setSale({ ...sale, customer_phone: e.target.value })} className="input-admin" />
                <select value={sale.product_id} onChange={(e) => setSale({ ...sale, product_id: e.target.value, variant_id: "" })} className="input-admin">
                  <option value="">Produit vendu</option>
                  {(products.data ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {selectedProduct && productVariants.length > 1 && (
                  <select value={sale.variant_id || selectedVariant?.id || ""} onChange={(e) => setSale({ ...sale, variant_id: e.target.value })} className="input-admin">
                    {productVariants.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {formatVariantLabel(Number(v.weight_value), v.weight_unit)}
                        {priceCurrency === "FCFA" ? ` · ${Number(v.price_fcfa).toLocaleString("fr-FR")} FCFA` : ` · $${Number(v.price_usd).toFixed(2)}`}
                      </option>
                    ))}
                  </select>
                )}
                {selectedProduct && (
                  <p className="text-xs text-muted-foreground">Stock disponible : {availableQty} unité{availableQty !== 1 ? "s" : ""}</p>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Qté"
                  value={sale.qty}
                  onChange={(e) => setSale({ ...sale, qty: e.target.value.replace(/\D/g, "") })}
                  className="input-admin input-qty"
                />
                <button
                  type="button"
                  disabled={!selectedProduct || !selectedVariant || availableQty <= 0 || !sale.qty}
                  onClick={() => {
                    if (!selectedProduct || !selectedVariant) return;
                    const parsedQty = Number.parseInt(sale.qty, 10);
                    if (!parsedQty || parsedQty < 1) {
                      toast.error("Indiquez une quantité valide");
                      return;
                    }
                    const qty = parsedQty;
                    if (qty > availableQty) {
                      toast.error(`Stock insuffisant (${availableQty} disponible)`);
                      return;
                    }
                    const label = formatVariantLabel(Number(selectedVariant.weight_value), selectedVariant.weight_unit);
                    const item = {
                      product_id: selectedProduct.id,
                      slug: selectedProduct.slug,
                      name: selectedProduct.name,
                      variant_id: selectedVariant.id,
                      variant_label: label,
                      qty,
                      price_fcfa: Number(selectedVariant.price_fcfa),
                      price_usd: Number(selectedVariant.price_usd),
                    };
                    const existingIndex = sale.items.findIndex((current: any) => current.product_id === item.product_id && current.variant_id === item.variant_id);
                    const nextItems = existingIndex >= 0
                      ? sale.items.map((current: any, index: number) => index === existingIndex ? { ...current, qty: current.qty + item.qty } : current)
                      : [...sale.items, item];
                    setSale({ ...sale, product_id: "", variant_id: "", qty: "", items: nextItems });
                  }}
                  className="rounded bg-espresso px-4 py-2 text-xs font-medium uppercase tracking-widest text-cream disabled:opacity-50"
                >
                  Ajouter le produit
                </button>
                <div className="space-y-2">
                  {sale.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun produit ajouté.</p>
                  ) : sale.items.map((item: any) => (
                    <div key={`${item.product_id}-${item.variant_id ?? "default"}`} className="flex items-center justify-between gap-3 rounded-xl bg-cream/70 p-3 text-sm">
                      <div>
                        <strong>{item.qty} × {item.name}{item.variant_label ? ` (${item.variant_label})` : ""}</strong>
                        <div className="text-xs text-muted-foreground">{formatItemTotal(item)}</div>
                      </div>
                      <button type="button" onClick={() => setSale({ ...sale, items: sale.items.filter((current: any) => !(current.product_id === item.product_id && current.variant_id === item.variant_id)) })} className="rounded-full p-2 text-red-600 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <select value={sale.payment_method} onChange={(e) => setSale({ ...sale, payment_method: e.target.value })} className="input-admin">
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="card">Carte</option>
                </select>
                <div className="rounded-xl bg-clay p-4 text-sm">
                  Total : <strong>{formatScopedMoney({ total_usd: totalUsd, total_fcfa: totalFcfa }, activePos?.city_scope)}</strong>
                </div>
                <button onClick={() => createSale.mutate()} disabled={createSale.isPending || sale.items.length === 0} className="btn-hero w-full disabled:opacity-50">
                  {createSale.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement</> : <><Plus className="w-4 h-4" /> Enregistrer la vente</>}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-2xl">Journal du jour</h2>
              <div className="mt-5 space-y-3">
                {todaySales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune vente aujourd'hui.</p>
                ) : todaySales.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl bg-cream/70 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-copper" />
                      <span>{s.customer_name ?? "Client comptoir"}</span>
                    </div>
                    <strong>{formatScopedMoney({ total_usd: s.total_usd, total_fcfa: s.total_fcfa }, activePos?.city_scope)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </StaffShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-3xl mt-2">{value}</div>
    </div>
  );
}
