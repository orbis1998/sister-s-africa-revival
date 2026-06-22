import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { StaffShell } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { adminUpsertProduct, adminDeleteProduct } from "@/lib/admin.functions";
import { formatVariantLabel, type WeightUnit } from "@/lib/product-variants";
import { Loader2, Plus, Trash2, Pencil, Upload } from "lucide-react";
import { RichContentEditor } from "@/components/admin/RichContentEditor";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: ProductsPage,
});

type VariantForm = {
  id?: string;
  weight_value: string;
  weight_unit: WeightUnit;
  price_usd: string;
  price_fcfa: string;
  price_cdf: string;
};

const emptyVariant = (): VariantForm => ({
  weight_value: "1",
  weight_unit: "kg",
  price_usd: "",
  price_fcfa: "",
  price_cdf: "",
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
  price_cdf: "",
  rdc_price_currency: "usd" as "usd" | "cdf",
  quantity: "",
  image_url: "",
  imageFile: null as File | null,
  is_active: true,
  is_bestseller: false,
  variants: [emptyVariant()] as VariantForm[],
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
  const { data: allVariants = [] } = useQuery({
    queryKey: ["admin-product-variants"],
    queryFn: async () => (await supabase.from("product_variants").select("*").order("sort_order")).data ?? [],
  });
  const [form, setForm] = useState<any>(null);

  const variantsFor = (productId: string) =>
    allVariants.filter((v: any) => v.product_id === productId).map((v: any) => ({
      id: v.id,
      weight_value: String(v.weight_value),
      weight_unit: v.weight_unit as WeightUnit,
      price_usd: String(v.price_usd),
      price_fcfa: String(v.price_fcfa),
      price_cdf: String(v.price_cdf ?? 0),
    }));

  const save = useMutation({
    mutationFn: async (data: any) => {
      const { imageFile, variants, ...payload } = data;
      const rdcCurrency = (payload.rdc_price_currency === "cdf" ? "cdf" : "usd") as "usd" | "cdf";
      const parsedVariants = (variants as VariantForm[])
        .filter((v) => Number(v.weight_value) > 0)
        .map((v, index) => ({
          id: v.id,
          weight_value: Number(v.weight_value),
          weight_unit: v.weight_unit,
          price_usd: Number(v.price_usd || 0),
          price_fcfa: Number.parseInt(v.price_fcfa || "0", 10),
          price_cdf: Number.parseInt(v.price_cdf || "0", 10),
          rdc_price_currency: rdcCurrency,
          sort_order: index,
        }));
      if (parsedVariants.length) {
        payload.price_usd = parsedVariants[0].price_usd;
        payload.price_fcfa = parsedVariants[0].price_fcfa;
        payload.price_cdf = parsedVariants[0].price_cdf;
        payload.rdc_price_currency = rdcCurrency;
      } else {
        payload.price_usd = Number(payload.price_usd || 0);
        payload.price_fcfa = Number.parseInt(payload.price_fcfa || "0", 10);
        payload.price_cdf = Number.parseInt(payload.price_cdf || "0", 10);
        payload.rdc_price_currency = rdcCurrency;
      }
      payload.price_cdf = Number.parseInt(payload.price_cdf || "0", 10);
      payload.rdc_price_currency = rdcCurrency;
      if (imageFile) {
        payload.image_url = await uploadProductImage(imageFile);
      }
      return upsertFn({ data: { ...payload, variants: parsedVariants } });
    },
    onSuccess: () => {
      toast.success("Enregistré");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["admin-all-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product-variants"] });
    },
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
        {products.map((p: any) => {
          const variants = variantsFor(p.id);
          const rdcCur = p.rdc_price_currency === "cdf" ? "CDF" : "USD";
          const rdcPrice = (v: VariantForm) =>
            p.rdc_price_currency === "cdf"
              ? `${Number(v.price_cdf || 0).toLocaleString("fr-FR")} CDF`
              : `$${v.price_usd}`;
          return (
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
                {variants.length > 1 ? (
                  <div className="mt-1 space-y-0.5">
                    {variants.map((v) => (
                      <p key={v.id} className="text-sm">
                        {formatVariantLabel(Number(v.weight_value), v.weight_unit)} · {rdcPrice(v)} · {v.price_fcfa} FCFA
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm mt-1">
                    <span className="text-muted-foreground">Prix RDC ({rdcCur}) :</span>{" "}
                    {p.rdc_price_currency === "cdf"
                      ? `${Number(p.price_cdf ?? 0).toLocaleString("fr-FR")} CDF`
                      : `$${p.price_usd}`}{" "}
                    · <span className="text-muted-foreground">Congo :</span> {p.price_fcfa} FCFA
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Stock géré par POS dans Inventaire</p>
                <div className="flex gap-1 mt-2">
                  {p.is_bestseller && <span className="text-[10px] px-2 py-0.5 rounded bg-gold/30">Best-seller</span>}
                  {!p.is_active && <span className="text-[10px] px-2 py-0.5 rounded bg-muted">Inactif</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setForm({
                    ...p,
                    price_cdf: String(p.price_cdf ?? 0),
                    rdc_price_currency: p.rdc_price_currency === "cdf" ? "cdf" : "usd",
                    imageFile: null,
                    variants: variants.length ? variants : [emptyVariant()],
                  })}
                  className="p-2 hover:bg-clay rounded"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => confirm("Supprimer ?") && del.mutate(p.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
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

              <Field label="Poids et prix disponibles" className="col-span-2">
                <div className="space-y-3 rounded-2xl border border-border bg-cream/40 p-4">
                  <p className="text-xs text-muted-foreground">
                    Ajoutez plusieurs lignes si le produit existe en plusieurs poids (ex. 500 g, 1 kg, 2 kg). Le client choisira sur la fiche produit.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">Devise RDC (par produit)</span>
                      <select
                        value={form.rdc_price_currency ?? "usd"}
                        onChange={(e) => setForm({ ...form, rdc_price_currency: e.target.value as "usd" | "cdf" })}
                        className="input-admin"
                      >
                        <option value="usd">USD — clients RDC voient le prix en dollars</option>
                        <option value="cdf">CDF — clients RDC voient le prix en francs congolais</option>
                      </select>
                    </label>
                    <p className="self-end text-xs text-muted-foreground">
                      Congo (Brazzaville / Pointe-Noire) : toujours FCFA. Livraison RDC : CDF au checkout.
                    </p>
                  </div>
                  {(form.variants as VariantForm[]).map((variant, index) => (
                    <div key={variant.id ?? index} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3">
                        <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">Poids</span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={variant.weight_value}
                          onChange={(e) => {
                            const next = [...form.variants];
                            next[index] = { ...variant, weight_value: e.target.value };
                            setForm({ ...form, variants: next });
                          }}
                          className="input-admin"
                        />
                      </div>
                      <div className="col-span-2">
                        <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">Unité</span>
                        <select
                          value={variant.weight_unit}
                          onChange={(e) => {
                            const next = [...form.variants];
                            next[index] = { ...variant, weight_unit: e.target.value as WeightUnit };
                            setForm({ ...form, variants: next });
                          }}
                          className="input-admin"
                        >
                          <option value="g">g</option>
                          <option value="kg">kg</option>
                        </select>
                      </div>
                      <div className="col-span-3">
                        <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
                          {form.rdc_price_currency === "cdf" ? "Prix CDF (RDC)" : "Prix USD (RDC)"}
                        </span>
                        {form.rdc_price_currency === "cdf" ? (
                          <input
                            type="number"
                            min={0}
                            value={variant.price_cdf}
                            onChange={(e) => {
                              const next = [...form.variants];
                              next[index] = { ...variant, price_cdf: e.target.value };
                              setForm({ ...form, variants: next });
                            }}
                            className="input-admin"
                          />
                        ) : (
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={variant.price_usd}
                            onChange={(e) => {
                              const next = [...form.variants];
                              next[index] = { ...variant, price_usd: e.target.value };
                              setForm({ ...form, variants: next });
                            }}
                            className="input-admin"
                          />
                        )}
                      </div>
                      <div className="col-span-3">
                        <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">FCFA (Congo)</span>
                        <input
                          type="number"
                          min={0}
                          value={variant.price_fcfa}
                          onChange={(e) => {
                            const next = [...form.variants];
                            next[index] = { ...variant, price_fcfa: e.target.value };
                            setForm({ ...form, variants: next });
                          }}
                          className="input-admin"
                        />
                      </div>
                      <div className="col-span-1">
                        <button
                          type="button"
                          disabled={(form.variants as VariantForm[]).length <= 1}
                          onClick={() => setForm({ ...form, variants: (form.variants as VariantForm[]).filter((_, i) => i !== index) })}
                          className="rounded p-2 text-destructive hover:bg-destructive/10 disabled:opacity-30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, variants: [...form.variants, emptyVariant()] })}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-widest"
                  >
                    <Plus className="h-4 w-4" /> Ajouter un poids
                  </button>
                </div>
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
