import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StaffShell } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { adminSetStock } from "@/lib/admin.functions";
import { formatVariantLabel } from "@/lib/product-variants";
import { useAuth } from "@/lib/auth";

type StockRow = {
  id: string;
  product_id: string;
  variant_id: string;
  pos_id: string | null;
  quantity: number;
  low_stock_threshold: number;
};

type VariantRow = {
  id: string;
  product_id: string;
  weight_value: number;
  weight_unit: "g" | "kg";
  price_usd: number;
  price_fcfa: number;
  sort_order: number;
  is_active: boolean;
};

type ProductRow = {
  id: string;
  name: string;
};

export const Route = createFileRoute("/_authenticated/admin/stock")({
  component: StockPage,
});

function StockPage() {
  const qc = useQueryClient();
  const { roles, user } = useAuth();
  const isAdmin = roles.includes("admin");
  const setStockFn = useServerFn(adminSetStock);
  const { data: managerPerms } = useQuery({
    queryKey: ["manager-stock-perms", user?.id],
    enabled: !!user && !isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("manager_permissions").select("can_manage_stock, pos_ids").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });
  const { data: products = [] } = useQuery({
    queryKey: ["admin-all-products"],
    queryFn: async () => (await supabase.from("products").select("id, name").order("name")).data ?? [] as ProductRow[],
  });
  const { data: variants = [] } = useQuery({
    queryKey: ["admin-all-variants"],
    queryFn: async () => (await supabase.from("product_variants").select("id, product_id, weight_value, weight_unit, price_usd, price_fcfa, sort_order, is_active").eq("is_active", true).order("sort_order")).data ?? [] as VariantRow[],
  });
  const { data: pos = [] } = useQuery({
    queryKey: ["admin-pos"],
    queryFn: async () => (await supabase.from("points_of_sale").select("*").order("name")).data ?? [],
  });
  const { data: stocks = [] } = useQuery({
    queryKey: ["admin-stocks"],
    queryFn: async () => (await supabase.from("stock").select("*")).data ?? [] as StockRow[],
  });

  const allowedPos = useMemo(() => {
    if (isAdmin) return pos;
    const ids = new Set((managerPerms?.pos_ids ?? []) as string[]);
    return pos.filter((p: any) => ids.has(p.id));
  }, [isAdmin, pos, managerPerms]);

  const stockRows = useMemo(() => {
    const productById = new Map(products.map((p) => [p.id, p]));
    return variants
      .map((variant) => {
        const product = productById.get(variant.product_id);
        if (!product) return null;
        return { variant, product };
      })
      .filter(Boolean) as Array<{ variant: VariantRow; product: ProductRow }>;
  }, [products, variants]);

  const [selectedPos, setSelectedPos] = useState<string>("");
  useEffect(() => {
    if (allowedPos.length && !selectedPos) {
      setSelectedPos(allowedPos[0].id);
    }
  }, [allowedPos, selectedPos]);

  const stockMut = useMutation({
    mutationFn: (data: any) => setStockFn({ data }),
    onSuccess: () => { toast.success("Stock mis à jour"); qc.invalidateQueries({ queryKey: ["admin-stocks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const getStock = (variantId: string) =>
    stocks.find((s) => s.variant_id === variantId && (s.pos_id ?? "") === (selectedPos || ""));

  const posStocks = stocks.filter((s) => (s.pos_id ?? "") === (selectedPos || ""));
  const variantById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const estimatedValue = posStocks.reduce((sum: { usd: number; fcfa: number }, row: StockRow) => {
    const variant = variantById.get(row.variant_id);
    if (!variant) return sum;
    return {
      usd: sum.usd + Number(variant.price_usd ?? 0) * Number(row.quantity ?? 0),
      fcfa: sum.fcfa + Number(variant.price_fcfa ?? 0) * Number(row.quantity ?? 0),
    };
  }, { usd: 0, fcfa: 0 });

  return (
    <StaffShell title="Administration" requiredRole={["admin", "manager"]} requiredPermission="can_manage_stock">
      <span className="eyebrow">Inventaire</span>
      <h1 className="font-display text-4xl mt-2">Stock</h1>
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs uppercase tracking-widest">Point de vente</label>
          <select
            value={selectedPos}
            onChange={(e) => setSelectedPos(e.target.value)}
            className="ml-3 px-3 py-2 border border-border rounded bg-background"
          >
            {allowedPos.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.city ? ` · ${p.city}` : ""}</option>)}
          </select>
        </div>
        {selectedPos && (
          <div className="rounded-2xl border border-border bg-card px-5 py-3 text-sm">
            <span className="text-muted-foreground">Valeur estimée du POS : </span>
            <strong className="text-copper">${estimatedValue.usd.toFixed(2)}</strong>
            <span className="text-muted-foreground"> · </span>
            <strong>{estimatedValue.fcfa.toLocaleString("fr-FR")} FCFA</strong>
          </div>
        )}
      </div>

      <div className="mt-6 bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-clay/50">
            <tr className="text-left text-xs uppercase tracking-widest">
              <th className="p-3">Produit</th><th className="p-3">Variante</th><th className="p-3">Quantité</th><th className="p-3">Seuil alerte</th><th className="p-3">Valeur unitaire</th><th className="p-3">Statut</th><th></th>
            </tr>
          </thead>
          <tbody>
            {stockRows.map(({ product, variant }) => {
              const s = getStock(variant.id);
              const low = s && s.quantity <= s.low_stock_threshold;
              const label = formatVariantLabel(Number(variant.weight_value), variant.weight_unit);
              return (
                <StockRowEditor
                  key={variant.id}
                  productName={product.name}
                  variantLabel={label}
                  variant={variant}
                  stock={s}
                  low={!!low}
                  onSave={(qty: number, threshold: number) => {
                    if (!selectedPos) {
                      toast.error("Sélectionnez un point de vente");
                      return;
                    }
                    stockMut.mutate({
                      product_id: product.id,
                      variant_id: variant.id,
                      pos_id: selectedPos,
                      quantity: qty,
                      low_stock_threshold: threshold,
                    });
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}

function StockRowEditor({ productName, variantLabel, variant, stock, low, onSave }: {
  productName: string;
  variantLabel: string;
  variant: VariantRow;
  stock?: StockRow;
  low: boolean;
  onSave: (qty: number, threshold: number) => void;
}) {
  const [qty, setQty] = useState(stock?.quantity ?? 0);
  const [thr, setThr] = useState(stock?.low_stock_threshold ?? 5);
  useEffect(() => {
    setQty(stock?.quantity ?? 0);
    setThr(stock?.low_stock_threshold ?? 5);
  }, [stock?.quantity, stock?.low_stock_threshold]);
  return (
    <tr className="border-t border-border">
      <td className="p-3">{productName}</td>
      <td className="p-3 text-muted-foreground">{variantLabel}</td>
      <td className="p-3"><input type="number" value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 0)} className="w-24 px-2 py-1 border border-border rounded bg-background" /></td>
      <td className="p-3"><input type="number" value={thr} onChange={(e) => setThr(parseInt(e.target.value) || 0)} className="w-24 px-2 py-1 border border-border rounded bg-background" /></td>
      <td className="p-3 text-xs text-muted-foreground">${variant.price_usd} · {Number(variant.price_fcfa).toLocaleString("fr-FR")} FCFA</td>
      <td className="p-3">{low ? <span className="text-destructive text-xs">⚠ Stock bas</span> : <span className="text-xs text-muted-foreground">OK</span>}</td>
      <td className="p-3 text-right"><button onClick={() => onSave(qty, thr)} className="text-xs uppercase tracking-widest text-copper">Enregistrer</button></td>
    </tr>
  );
}
