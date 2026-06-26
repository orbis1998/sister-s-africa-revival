import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ExternalLink } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { adminUpdateSiteSettings } from "@/lib/admin.functions";
import { defaultSiteSettings, fetchSiteSettings, type SiteSettings } from "@/lib/site-settings";

type PageFieldPrefix = "pos_page" | "expedition_page" | "contact_page";

type PageFields = {
  eyebrow: string;
  title: string;
  ctaLabel: string;
  ctaHref: string;
  ctaSecondary: string;
};

function pickPageFields(settings: SiteSettings, prefix: PageFieldPrefix): PageFields {
  const eyebrowKey = `${prefix}_eyebrow` as keyof SiteSettings;
  const titleKey = `${prefix}_title` as keyof SiteSettings;
  const ctaLabelKey = `${prefix}_cta_label` as keyof SiteSettings;
  const ctaHrefKey = `${prefix}_cta_href` as keyof SiteSettings;
  const ctaSecondaryKey = `${prefix}_cta_secondary_label` as keyof SiteSettings;
  return {
    eyebrow: String(settings[eyebrowKey] ?? ""),
    title: String(settings[titleKey] ?? ""),
    ctaLabel: String(settings[ctaLabelKey] ?? ""),
    ctaHref: String(settings[ctaHrefKey] ?? ""),
    ctaSecondary: String(settings[ctaSecondaryKey] ?? ""),
  };
}

function mergePageFields(settings: SiteSettings, prefix: PageFieldPrefix, fields: PageFields): SiteSettings {
  const eyebrowKey = `${prefix}_eyebrow` as keyof SiteSettings;
  const titleKey = `${prefix}_title` as keyof SiteSettings;
  const ctaLabelKey = `${prefix}_cta_label` as keyof SiteSettings;
  const ctaHrefKey = `${prefix}_cta_href` as keyof SiteSettings;
  const ctaSecondaryKey = `${prefix}_cta_secondary_label` as keyof SiteSettings;
  return {
    ...settings,
    [eyebrowKey]: fields.eyebrow,
    [titleKey]: fields.title,
    [ctaLabelKey]: fields.ctaLabel,
    [ctaHrefKey]: fields.ctaHref,
    [ctaSecondaryKey]: fields.ctaSecondary,
  };
}

export function PublicPageEditor({
  prefix,
  title,
  description,
  previewPath,
  posCardsHint,
  showCtas = true,
}: {
  prefix: PageFieldPrefix;
  title: string;
  description: string;
  previewPath: string;
  posCardsHint?: string;
  showCtas?: boolean;
}) {
  const updateSettings = useServerFn(adminUpdateSiteSettings);
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["site-settings-admin"], queryFn: fetchSiteSettings });
  const [fields, setFields] = useState<PageFields>(() => pickPageFields(defaultSiteSettings, prefix));

  useEffect(() => {
    if (settings.data) setFields(pickPageFields(settings.data, prefix));
  }, [settings.data, prefix]);

  const save = useMutation({
    mutationFn: () => {
      if (!settings.data) throw new Error("Paramètres non chargés");
      return updateSettings({ data: mergePageFields(settings.data, prefix, fields) });
    },
    onSuccess: () => {
      toast.success("Page enregistrée");
      qc.invalidateQueries({ queryKey: ["site-settings-admin"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (settings.isLoading) {
    return (
      <div className="mt-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          {posCardsHint && <p className="mt-2 text-xs text-copper">{posCardsHint}</p>}
        </div>
        <Link to={previewPath as any} target="_blank" className="btn-ghost text-xs">
          <ExternalLink className="h-3.5 w-3.5" /> Voir la page
        </Link>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Surtitre">
          <input
            value={fields.eyebrow}
            onChange={(e) => setFields({ ...fields, eyebrow: e.target.value })}
            className="input-admin"
          />
        </Field>
        {showCtas && (
          <>
            <Field label="Titre principal" className="sm:col-span-2">
              <input
                value={fields.title}
                onChange={(e) => setFields({ ...fields, title: e.target.value })}
                className="input-admin"
              />
            </Field>
            <Field label="Label bouton principal">
              <input
                value={fields.ctaLabel}
                onChange={(e) => setFields({ ...fields, ctaLabel: e.target.value })}
                className="input-admin"
              />
            </Field>
            <Field label="Lien bouton principal">
              <input
                value={fields.ctaHref}
                onChange={(e) => setFields({ ...fields, ctaHref: e.target.value })}
                className="input-admin"
              />
            </Field>
            <Field label="Label bouton WhatsApp" className="sm:col-span-2">
              <input
                value={fields.ctaSecondary}
                onChange={(e) => setFields({ ...fields, ctaSecondary: e.target.value })}
                className="input-admin"
              />
            </Field>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="btn-hero mt-6"
      >
        {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…</> : "Enregistrer la page"}
      </button>
    </div>
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
