import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { StaffShell } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { adminUpsertProduct, adminDeleteProduct } from "@/lib/admin.functions";
import { Loader2, Plus, Trash2, Pencil, Upload } from "lucide-react";
import { RichContentEditor } from "@/components/admin/RichContentEditor";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: ProductsPage,
});

const empty = {
  slug: "",
  name: "",
  description: "",
  content_html: "",
  seo_title: "",
  seo_description: "",
  price_usd: "",
  price_fcfa: "",
  quantity: "",
  image_url: "",
  imageFile: null as File | null,
  is_active: true,
  is_bestseller: false,
};

async function uploadProductImage(file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const safeName = file.name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const path = `${crypto.randomUUID()}-${safeName}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

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
    mutationFn: async (data: any) => {
      const { imageFile, ...payload } = data;
      payload.price_usd = Number(payload.price_usd || 0);
      payload.price_fcfa = Number.parseInt(payload.price_fcfa || "0", 10);
      payload.quantity = Number.parseInt(payload.quantity || "0", 10);
      if (imageFile) {
        payload.image_url = await uploadProductImage(imageFile);
      }
      return upsertFn({ data: payload });
    },
    onSuccess: () => { toast.success("Enregistré"); setForm(null); qc.invalidateQueries({ queryKey: ["admin-all-products"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["admin-all-products"] }); },
  });

  return (
    <StaffShell title="Administration" requiredRole={["admin", "manager"]} requiredPermission="can_manage_products">
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
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="w-20 h-20 object-cover rounded-xl" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-clay flex items-center justify-center text-[10px] uppercase tracking-widest text-muted-foreground">
                Image
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-display text-lg">{p.name}</h3>
              <p className="text-xs text-muted-foreground">{p.slug}</p>
              <p className="text-sm mt-1"><span className="text-muted-foreground">Prix :</span> ${p.price_usd} · {p.price_fcfa} FCFA</p>
              <p className="text-xs text-muted-foreground mt-1"><span className="text-muted-foreground">Stock :</span> {p.quantity ?? 0} unité{(p.quantity ?? 0) !== 1 ? "s" : ""}</p>
              <div className="flex gap-1 mt-2">
                {p.is_bestseller && <span className="text-[10px] px-2 py-0.5 rounded bg-gold/30">Best-seller</span>}
                {!p.is_active && <span className="text-[10px] px-2 py-0.5 rounded bg-muted">Inactif</span>}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => setForm({ ...p, imageFile: null })} className="p-2 hover:bg-clay rounded"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => confirm("Supprimer ?") && del.mutate(p.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 bg-espresso/60 z-50 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-card rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-2xl">{form.id ? "Modifier" : "Nouveau produit"}</h2>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Field label="Nom du produit" className="col-span-2">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-admin" />
              </Field>
              <Field label="Slug (URL)" className="col-span-2">
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="input-admin" placeholder="ex. mass-gainer" />
              </Field>
              <Field label="Résumé court" className="col-span-2">
                <textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-admin resize-none" rows={2} placeholder="Texte court pour les cartes produit et SEO fallback" />
              </Field>
              <Field label="Description riche (Shopify-like)" className="col-span-2">
                <RichContentEditor
                  value={form.content_html ?? ""}
                  onChange={(html) => setForm({ ...form, content_html: html })}
                  uploadBucket="product-images"
                />
              </Field>
              <Field label="SEO — Titre">
                <input value={form.seo_title ?? ""} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} className="input-admin" placeholder="Titre meta personnalisé" />
              </Field>
              <Field label="SEO — Description">
                <input value={form.seo_description ?? ""} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} className="input-admin" placeholder="Description meta" />
              </Field>
              <Field label="Prix (USD)">
                <input type="number" step="0.01" min={0} value={form.price_usd || ""} onChange={(e) => setForm({ ...form, price_usd: e.target.value })} className="input-admin" />
              </Field>
              <Field label="Prix (FCFA)">
                <input type="number" min={0} value={form.price_fcfa || ""} onChange={(e) => setForm({ ...form, price_fcfa: e.target.value })} className="input-admin" />
              </Field>
              <Field label="Stock disponible" className="col-span-2">
                <input type="number" min={0} value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="input-admin" />
                <p className="mt-1.5 text-xs text-muted-foreground">Nombre d'unités en stock pour la vente en ligne.</p>
              </Field>
              <Field label="Image du produit" className="col-span-2">
                <div className="rounded-2xl border border-dashed border-border bg-cream/50 p-4">
                  <div className="grid gap-4 sm:grid-cols-[120px_1fr] sm:items-center">
                    <div className="h-28 w-28 overflow-hidden rounded-xl bg-clay">
                      {form.imageFile ? (
                        <img src={URL.createObjectURL(form.imageFile)} alt="Aperçu" className="h-full w-full object-cover" />
                      ) : form.image_url ? (
                        <img src={form.image_url} alt="Aperçu" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-widest text-muted-foreground">Image</div>
                      )}
                    </div>
                    <div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-espresso px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-cream transition hover:bg-copper">
                        <Upload className="w-4 h-4" />
                        Importer une image
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => setForm({ ...form, imageFile: e.target.files?.[0] ?? null })}
                        />
                      </label>
                      <p className="mt-2 text-xs text-muted-foreground">
                        L'image sera envoyée dans Supabase Storage, plus besoin de coller une URL.
                      </p>
                    </div>
                  </div>
                </div>
              </Field>
              <Field label="Visibilité">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Produit actif (visible sur le site)</label>
              </Field>
              <Field label="Mise en avant">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_bestseller} onChange={(e) => setForm({ ...form, is_bestseller: e.target.checked })} /> Afficher en best-seller</label>
              </Field>
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <button className="btn-ghost" onClick={() => setForm(null)}>Annuler</button>
              <button className="btn-hero" disabled={save.isPending} onClick={() => save.mutate(form)}>
                {save.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement</> : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={className ?? "block"}>
      <span className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
