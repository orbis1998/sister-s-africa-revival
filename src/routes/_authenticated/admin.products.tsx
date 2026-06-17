import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { StaffShell } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { adminUpsertProduct, adminDeleteProduct } from "@/lib/admin.functions";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: ProductsPage,
});

const empty = { slug: "", name: "", description: "", price_usd: 0, price_fcfa: 0, image_url: "", is_active: true, is_bestseller: false };

function ProductsPage() {
  const qc = useQueryClient();
  const upsertFn = useServerFn(adminUpsertProduct);
  const deleteFn = useServerFn(adminDeleteProduct);
  const { data: products = [] } = useQuery({
    queryKey: ["admin-all-products"],
    queryFn: async () => (await supabase.from("products").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const [form, setForm] = useState<any>(null);

  const save = useMutation({
    mutationFn: (data: any) => upsertFn({ data }),
    onSuccess: () => { toast.success("Enregistré"); setForm(null); qc.invalidateQueries({ queryKey: ["admin-all-products"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["admin-all-products"] }); },
  });

  return (
    <StaffShell title="Administration" requiredRole="admin">
      <div className="flex justify-between items-end">
        <div>
          <span className="eyebrow">Catalogue</span>
          <h1 className="font-display text-4xl mt-2">Produits</h1>
        </div>
        <button onClick={() => setForm(empty)} className="btn-hero"><Plus className="w-4 h-4" /> Nouveau</button>
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        {products.map((p: any) => (
          <div key={p.id} className="bg-card border border-border rounded-2xl p-5 flex gap-4">
            {p.image_url && <img src={p.image_url} alt={p.name} className="w-20 h-20 object-cover rounded" />}
            <div className="flex-1">
              <h3 className="font-display text-lg">{p.name}</h3>
              <p className="text-xs text-muted-foreground">{p.slug}</p>
              <p className="text-sm mt-1">${p.price_usd} · {p.price_fcfa} FCFA</p>
              <div className="flex gap-1 mt-2">
                {p.is_bestseller && <span className="text-[10px] px-2 py-0.5 rounded bg-gold/30">Best-seller</span>}
                {!p.is_active && <span className="text-[10px] px-2 py-0.5 rounded bg-muted">Inactif</span>}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => setForm(p)} className="p-2 hover:bg-clay rounded"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => confirm("Supprimer ?") && del.mutate(p.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 bg-espresso/60 z-50 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-card rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-2xl">{form.id ? "Modifier" : "Nouveau produit"}</h2>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="col-span-2 px-3 py-2 border border-border rounded bg-background" />
              <input placeholder="Slug (URL)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="col-span-2 px-3 py-2 border border-border rounded bg-background" />
              <textarea placeholder="Description" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="col-span-2 px-3 py-2 border border-border rounded bg-background" rows={3} />
              <input type="number" step="0.01" placeholder="Prix USD" value={form.price_usd} onChange={(e) => setForm({ ...form, price_usd: parseFloat(e.target.value) || 0 })} className="px-3 py-2 border border-border rounded bg-background" />
              <input type="number" placeholder="Prix FCFA" value={form.price_fcfa} onChange={(e) => setForm({ ...form, price_fcfa: parseInt(e.target.value) || 0 })} className="px-3 py-2 border border-border rounded bg-background" />
              <input placeholder="URL image" value={form.image_url ?? ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="col-span-2 px-3 py-2 border border-border rounded bg-background" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Actif</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_bestseller} onChange={(e) => setForm({ ...form, is_bestseller: e.target.checked })} /> Best-seller</label>
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <button className="btn-ghost" onClick={() => setForm(null)}>Annuler</button>
              <button className="btn-hero" disabled={save.isPending} onClick={() => save.mutate(form)}>
                {save.isPending ? "…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
