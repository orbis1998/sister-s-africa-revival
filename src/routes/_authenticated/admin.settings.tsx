import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { StaffShell } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { adminUpdateSiteSettings } from "@/lib/admin.functions";
import { defaultSiteSettings, defaultHomeStats, fetchSiteSettings, type HomeStatCard } from "@/lib/site-settings";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

async function uploadSiteAsset(file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `hero/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("site-assets").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
}

function SettingsPage() {
  const updateSettings = useServerFn(adminUpdateSiteSettings);
  const qc = useQueryClient();
  const [form, setForm] = useState(defaultSiteSettings);

  const settings = useQuery({
    queryKey: ["site-settings-admin"],
    queryFn: fetchSiteSettings,
  });

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => updateSettings({ data: form }),
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      qc.invalidateQueries({ queryKey: ["site-settings-admin"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function onImage(index: number, file?: File) {
    if (!file) return;
    try {
      const url = await uploadSiteAsset(file);
      const next = [...(form.hero_images ?? [])];
      next[index] = url;
      setForm({ ...form, hero_images: next.slice(0, 3) });
      toast.success("Image ajoutée");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <StaffShell title="Administration" requiredRole="admin">
      <span className="eyebrow">Expérience client</span>
      <h1 className="font-display text-4xl mt-2">Paramètres du site</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Gérez ici le hero de l'accueil, les images défilantes, le CTA, le numéro WhatsApp, la section Notre histoire et les statistiques.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="grid gap-4">
            <Field label="Surtitre">
              <input value={form.hero_eyebrow} onChange={(e) => setForm({ ...form, hero_eyebrow: e.target.value })} className="input-admin" />
            </Field>
            <Field label="Titre hero">
              <input value={form.hero_title} onChange={(e) => setForm({ ...form, hero_title: e.target.value })} className="input-admin" />
            </Field>
            <Field label="Mot à mettre en or">
              <input value={form.hero_highlight} onChange={(e) => setForm({ ...form, hero_highlight: e.target.value })} className="input-admin" />
            </Field>
            <Field label="Texte descriptif">
              <textarea value={form.hero_subtitle} onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })} rows={4} className="input-admin resize-none" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Label CTA">
                <input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} className="input-admin" />
              </Field>
              <Field label="Lien CTA">
                <input value={form.cta_href} onChange={(e) => setForm({ ...form, cta_href: e.target.value })} className="input-admin" />
              </Field>
            </div>
            <Field label="WhatsApp redirection (sans +)">
              <input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} className="input-admin" />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl">Images hero</h2>
          <p className="text-xs text-muted-foreground mt-1">Ajoutez jusqu'à 3 images pour l'effet défilant.</p>
          <div className="mt-5 space-y-4">
            {[0, 1, 2].map((index) => (
              <label key={index} className="block cursor-pointer rounded-2xl border border-dashed border-border bg-cream/50 p-3">
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => onImage(index, e.target.files?.[0])} />
                {form.hero_images?.[index] ? (
                  <img src={form.hero_images[index]} alt={`Hero ${index + 1}`} className="h-32 w-full rounded-xl object-cover" />
                ) : (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Upload className="w-5 h-5" />
                    <span className="text-xs">Image {index + 1}</span>
                  </div>
                )}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl">Notre histoire (accueil)</h2>
          <div className="mt-5 grid gap-4">
            <Field label="Surtitre">
              <input value={form.story_eyebrow ?? ""} onChange={(e) => setForm({ ...form, story_eyebrow: e.target.value })} className="input-admin" />
            </Field>
            <Field label="Titre">
              <input value={form.story_title ?? ""} onChange={(e) => setForm({ ...form, story_title: e.target.value })} className="input-admin" />
            </Field>
            <Field label="Paragraphe 1">
              <textarea value={form.story_paragraph_1 ?? ""} onChange={(e) => setForm({ ...form, story_paragraph_1: e.target.value })} rows={4} className="input-admin resize-none" />
            </Field>
            <Field label="Paragraphe 2">
              <textarea value={form.story_paragraph_2 ?? ""} onChange={(e) => setForm({ ...form, story_paragraph_2: e.target.value })} rows={3} className="input-admin resize-none" />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl">Statistiques accueil</h2>
          <p className="mt-1 text-xs text-muted-foreground">Les 4 cartes affichées à côté de Notre histoire.</p>
          <div className="mt-5 space-y-4">
            {(form.home_stats ?? defaultHomeStats).slice(0, 4).map((stat: HomeStatCard, index: number) => (
              <div key={index} className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border bg-cream/30 p-4">
                <Field label={`Valeur ${index + 1}`}>
                  <input
                    value={stat.value}
                    onChange={(e) => {
                      const next = [...(form.home_stats ?? defaultHomeStats)];
                      next[index] = { ...next[index], value: e.target.value };
                      setForm({ ...form, home_stats: next });
                    }}
                    className="input-admin"
                  />
                </Field>
                <Field label={`Libellé ${index + 1}`}>
                  <input
                    value={stat.label}
                    onChange={(e) => {
                      const next = [...(form.home_stats ?? defaultHomeStats)];
                      next[index] = { ...next[index], label: e.target.value };
                      setForm({ ...form, home_stats: next });
                    }}
                    className="input-admin"
                  />
                </Field>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl">SEO & réseaux sociaux</h2>
        <p className="mt-1 text-xs text-muted-foreground">Meta tags globaux du site (Open Graph, Twitter, Google).</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Titre SEO global">
            <input value={form.seo_title ?? ""} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} className="input-admin" />
          </Field>
          <Field label="URL du site">
            <input value={form.site_url ?? ""} onChange={(e) => setForm({ ...form, site_url: e.target.value })} className="input-admin" />
          </Field>
          <Field label="Description SEO" className="sm:col-span-2">
            <textarea value={form.seo_description ?? ""} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} className="input-admin resize-none" rows={3} />
          </Field>
          <Field label="Mots-clés">
            <input value={form.seo_keywords ?? ""} onChange={(e) => setForm({ ...form, seo_keywords: e.target.value })} className="input-admin" />
          </Field>
          <Field label="Twitter / X">
            <input value={form.twitter_handle ?? ""} onChange={(e) => setForm({ ...form, twitter_handle: e.target.value })} className="input-admin" placeholder="@thesistersafrica" />
          </Field>
          <Field label="Image Open Graph (URL)" className="sm:col-span-2">
            <input value={form.og_image_url ?? ""} onChange={(e) => setForm({ ...form, og_image_url: e.target.value })} className="input-admin" placeholder="https://..." />
          </Field>
        </div>
      </div>

      <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-hero mt-8">
        {save.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement</> : "Enregistrer les paramètres"}
      </button>
    </StaffShell>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
