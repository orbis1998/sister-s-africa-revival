import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { StaffShell } from "@/components/admin/AdminLayout";
import { RichContentEditor } from "@/components/admin/RichContentEditor";
import { adminDeleteBlogPost, adminListBlogPosts, adminUpsertBlogPost } from "@/lib/blog.functions";
import { blogPostPathKey, slugifyBlogTitle } from "@/lib/blog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, Pencil, Upload, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/blog")({
  component: BlogAdminPage,
});

const empty = {
  slug: "",
  title: "",
  excerpt: "",
  content_html: "",
  cover_image_url: "",
  category: "",
  read_time: "4 min",
  sort_order: "0",
  is_published: true,
  seo_title: "",
  seo_description: "",
  coverFile: null as File | null,
};

async function uploadCover(file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `blog/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("site-assets").upload(path, file, { cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return supabase.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
}

function BlogAdminPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListBlogPosts);
  const upsertFn = useServerFn(adminUpsertBlogPost);
  const deleteFn = useServerFn(adminDeleteBlogPost);
  const { data: posts = [], isLoading } = useQuery({ queryKey: ["admin-blog"], queryFn: () => listFn() });
  const [form, setForm] = useState<any>(null);

  const save = useMutation({
    mutationFn: async (data: any) => {
      const { coverFile, ...payload } = data;
      payload.sort_order = Number.parseInt(payload.sort_order || "0", 10);
      payload.slug = slugifyBlogTitle(payload.slug?.trim() || payload.title || "article");
      if (!payload.title?.trim()) throw new Error("Le titre est obligatoire");
      if (coverFile) payload.cover_image_url = await uploadCover(coverFile);
      return upsertFn({ data: payload });
    },
    onSuccess: () => {
      toast.success("Article enregistré");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["admin-blog"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Article supprimé");
      qc.invalidateQueries({ queryKey: ["admin-blog"] });
    },
  });

  return (
    <StaffShell title="Administration" requiredRole="admin">
      <div className="flex justify-between items-end">
        <div>
          <span className="eyebrow">Contenu</span>
          <h1 className="font-display text-4xl mt-2">Blog</h1>
        </div>
        <button className="btn-hero" onClick={() => setForm({ ...empty })}><Plus className="w-4 h-4" /> Nouvel article</button>
      </div>

      {isLoading ? (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
      ) : (
        <div className="mt-8 space-y-3">
          {posts.map((post: any) => (
            <div key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <div>
                <div className="font-display text-xl">{post.title}</div>
                <div className="text-xs text-muted-foreground">/{post.slug} · {post.category} · {post.is_published ? "Publié" : "Brouillon"}</div>
              </div>
              <div className="flex gap-2">
                <Link to="/article/$slug" params={{ slug: blogPostPathKey(post) }} className="btn-ghost text-xs" target="_blank">
                  <ExternalLink className="w-3.5 h-3.5" /> Voir
                </Link>
                <button className="btn-ghost text-xs" onClick={() => setForm({ ...post, sort_order: String(post.sort_order), coverFile: null })}>
                  <Pencil className="w-3.5 h-3.5" /> Modifier
                </button>
                <button className="btn-ghost text-xs text-red-700" onClick={() => del.mutate(post.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl bg-card p-6 shadow-elegant">
            <h2 className="font-display text-2xl mb-6">{form.id ? "Modifier l'article" : "Nouvel article"}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Titre" className="sm:col-span-2">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-admin" />
              </Field>
              <Field label="Slug URL">
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="input-admin" />
              </Field>
              <Field label="Catégorie">
                <input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-admin" />
              </Field>
              <Field label="Temps de lecture">
                <input value={form.read_time ?? ""} onChange={(e) => setForm({ ...form, read_time: e.target.value })} className="input-admin" />
              </Field>
              <Field label="Ordre">
                <input type="number" value={form.sort_order ?? "0"} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className="input-admin" />
              </Field>
              <Field label="Extrait" className="sm:col-span-2">
                <textarea value={form.excerpt ?? ""} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} className="input-admin resize-none" rows={2} />
              </Field>
              <Field label="Image de couverture" className="sm:col-span-2">
                <div className="flex flex-wrap items-center gap-4">
                  {(form.coverFile || form.cover_image_url) && (
                    <img
                      src={form.coverFile ? URL.createObjectURL(form.coverFile) : form.cover_image_url}
                      alt=""
                      className="h-24 w-36 rounded-xl object-cover"
                    />
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-espresso px-4 py-2 text-xs uppercase tracking-widest text-cream">
                    <Upload className="w-4 h-4" /> Importer
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => setForm({ ...form, coverFile: e.target.files?.[0] ?? null })} />
                  </label>
                </div>
              </Field>
              <Field label="Contenu riche" className="sm:col-span-2">
                <RichContentEditor value={form.content_html ?? ""} onChange={(html) => setForm({ ...form, content_html: html })} />
              </Field>
              <Field label="SEO Titre">
                <input value={form.seo_title ?? ""} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} className="input-admin" />
              </Field>
              <Field label="SEO Description">
                <input value={form.seo_description ?? ""} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} className="input-admin" />
              </Field>
              <Field label="Visibilité" className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
                  Article publié sur le site
                </label>
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setForm(null)}>Annuler</button>
              <button className="btn-hero" disabled={save.isPending} onClick={() => save.mutate(form)}>
                {save.isPending ? "Enregistrement…" : "Enregistrer"}
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
