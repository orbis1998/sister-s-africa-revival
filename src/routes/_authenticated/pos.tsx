import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, ShoppingCart } from "lucide-react";
import { StaffShell } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/pos")({
  component: PosDashboard,
});

function PosDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sale, setSale] = useState<any>({ customer_name: "", customer_phone: "", product_id: "", qty: 1, payment_method: "cash" });

  const assignment = useQuery({
    queryKey: ["pos-assignment", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("pos_accounts")
        .select("pos_id, points_of_sale(name, city, address)")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as any;
    },
  });

  const products = useQuery({
    queryKey: ["pos-products"],
    queryFn: async () => (await supabase.from("products").select("*").eq("is_active", true).order("name")).data ?? [],
  });

  const stock = useQuery({
    queryKey: ["pos-stock", assignment.data?.pos_id],
    enabled: !!assignment.data?.pos_id,
    queryFn: async () => (await supabase.from("stock").select("*").eq("pos_id", assignment.data.pos_id)).data ?? [],
  });

  const sales = useQuery({
    queryKey: ["pos-sales", assignment.data?.pos_id],
    enabled: !!assignment.data?.pos_id,
    queryFn: async () => (await supabase.from("pos_sales").select("*").eq("pos_id", assignment.data.pos_id).order("created_at", { ascending: false })).data ?? [],
  });

  const selectedProduct = products.data?.find((p: any) => p.id === sale.product_id);
  const totalFcfa = selectedProduct ? Number(selectedProduct.price_fcfa) * Number(sale.qty || 1) : 0;
  const totalUsd = selectedProduct ? Number(selectedProduct.price_usd) * Number(sale.qty || 1) : 0;

  const todaySales = useMemo(() => {
    const today = new Date().toDateString();
    return (sales.data ?? []).filter((s: any) => new Date(s.created_at).toDateString() === today);
  }, [sales.data]);
  const todayRevenue = todaySales.reduce((sum: number, s: any) => sum + Number(s.total_fcfa ?? 0), 0);

  const createSale = useMutation({
    mutationFn: async () => {
      if (!user || !assignment.data?.pos_id || !selectedProduct) throw new Error("Vente incomplète");
      const payload = {
        pos_id: assignment.data.pos_id,
        sold_by: user.id,
        customer_name: sale.customer_name || null,
        customer_phone: sale.customer_phone || null,
        payment_method: sale.payment_method,
        total_fcfa: totalFcfa,
        total_usd: totalUsd,
        items: [{
          product_id: selectedProduct.id,
          slug: selectedProduct.slug,
          name: selectedProduct.name,
          qty: Number(sale.qty || 1),
          price_fcfa: Number(selectedProduct.price_fcfa),
          price_usd: Number(selectedProduct.price_usd),
        }],
      };
      const { error } = await supabase.from("pos_sales").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vente enregistrée");
      setSale({ customer_name: "", customer_phone: "", product_id: "", qty: 1, payment_method: "cash" });
      qc.invalidateQueries({ queryKey: ["pos-sales", assignment.data?.pos_id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <StaffShell title="Point de vente" requiredRole="pos">
      <span className="eyebrow">Caisse POS</span>
      <h1 className="font-display text-4xl mt-2">{assignment.data?.points_of_sale?.name ?? "Point de vente"}</h1>
      <p className="text-sm text-muted-foreground mt-1">{assignment.data?.points_of_sale?.city}</p>

      {assignment.isLoading ? (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</div>
      ) : !assignment.data?.pos_id ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
          Aucun point de vente n'est associé à ce compte.
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Stat label="Ventes du jour" value={todaySales.length} />
            <Stat label="CA journalier" value={`${todayRevenue.toLocaleString("fr-FR")} FCFA`} />
            <Stat label="Produits en stock" value={stock.data?.length ?? 0} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-2xl">Nouvelle vente</h2>
              <div className="mt-5 grid gap-3">
                <input placeholder="Nom client (optionnel)" value={sale.customer_name} onChange={(e) => setSale({ ...sale, customer_name: e.target.value })} className="input-admin" />
                <input placeholder="Téléphone client (optionnel)" value={sale.customer_phone} onChange={(e) => setSale({ ...sale, customer_phone: e.target.value })} className="input-admin" />
                <select value={sale.product_id} onChange={(e) => setSale({ ...sale, product_id: e.target.value })} className="input-admin">
                  <option value="">Produit vendu</option>
                  {(products.data ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" min={1} value={sale.qty} onChange={(e) => setSale({ ...sale, qty: parseInt(e.target.value) || 1 })} className="input-admin" />
                <select value={sale.payment_method} onChange={(e) => setSale({ ...sale, payment_method: e.target.value })} className="input-admin">
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="card">Carte</option>
                </select>
                <div className="rounded-xl bg-clay p-4 text-sm">
                  Total : <strong>{totalFcfa.toLocaleString("fr-FR")} FCFA</strong> · ${totalUsd}
                </div>
                <button onClick={() => createSale.mutate()} disabled={createSale.isPending || !selectedProduct} className="btn-hero w-full disabled:opacity-50">
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
                    <strong>{Number(s.total_fcfa).toLocaleString("fr-FR")} FCFA</strong>
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
