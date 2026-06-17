import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { StaffShell } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { adminSetStock } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/stock")({
  component: StockPage,
});

function StockPage() {
  const qc = useQueryClient();
  const setStockFn = useServerFn(adminSetStock);
  const { data: products = [] } = useQuery({
    queryKey: ["admin-all-products"],
    queryFn: async () => (await supabase.from("products").select("*").order("name")).data ?? [],
  });
  const { data: pos = [] } = useQuery({
    queryKey: ["admin-pos"],
    queryFn: async () => (await supabase.from("points_of_sale").select("*").order("name")).data ?? [],
  });
  const { data: stocks = [] } = useQuery({
    queryKey: ["admin-stocks"],
    queryFn: async () => (await supabase.from("stock").select("*")).data ?? [],
  });

  const [selectedPos, setSelectedPos] = useState<string>("");
  const stockMut = useMutation({
    mutationFn: (data: any) => setStockFn({ data }),
    onSuccess: () => { toast.success("Stock mis à jour"); qc.invalidateQueries({ queryKey: ["admin-stocks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const getStock = (pid: string) =>
    stocks.find((s: any) => s.product_id === pid && (s.pos_id ?? "") === (selectedPos || ""));

  return (
    <StaffShell title="Administration" requiredRole="admin">
      <span className="eyebrow">Inventaire</span>
      <h1 className="font-display text-4xl mt-2">Stock</h1>
      <div className="mt-6">
        <label className="text-xs uppercase tracking-widest">Point de vente</label>
        <select value={selectedPos} onChange={(e) => setSelectedPos(e.target.value)}
          className="ml-3 px-3 py-2 border border-border rounded bg-background">
          <option value="">— Stock central —</option>
          {pos.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="mt-6 bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-clay/50">
            <tr className="text-left text-xs uppercase tracking-widest">
              <th className="p-3">Produit</th><th className="p-3">Quantité</th><th className="p-3">Seuil alerte</th><th className="p-3">Statut</th><th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p: any) => {
              const s = getStock(p.id);
              const low = s && s.quantity <= s.low_stock_threshold;
              return (
                <StockRow key={p.id} product={p} stock={s} low={!!low}
                  onSave={(qty: number, threshold: number) => stockMut.mutate({
                    product_id: p.id, pos_id: selectedPos || null, quantity: qty, low_stock_threshold: threshold,
                  })} />
              );
            })}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}

function StockRow({ product, stock, low, onSave }: any) {
  const [qty, setQty] = useState(stock?.quantity ?? 0);
  const [thr, setThr] = useState(stock?.low_stock_threshold ?? 5);
  return (
    <tr className="border-t border-border">
      <td className="p-3">{product.name}</td>
      <td className="p-3"><input type="number" value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 0)} className="w-24 px-2 py-1 border border-border rounded bg-background" /></td>
      <td className="p-3"><input type="number" value={thr} onChange={(e) => setThr(parseInt(e.target.value) || 0)} className="w-24 px-2 py-1 border border-border rounded bg-background" /></td>
      <td className="p-3">{low ? <span className="text-destructive text-xs">⚠ Stock bas</span> : <span className="text-xs text-muted-foreground">OK</span>}</td>
      <td className="p-3 text-right"><button onClick={() => onSave(qty, thr)} className="text-xs uppercase tracking-widest text-copper">Enregistrer</button></td>
    </tr>
  );
}
