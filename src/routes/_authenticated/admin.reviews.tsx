import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Loader2, Star, Trash2, X } from "lucide-react";
import { StaffShell } from "@/components/admin/AdminLayout";
import { adminDeleteReview, adminListReviews, adminModerateReview } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  component: ReviewsAdminPage,
});

function ReviewsAdminPage() {
  const listReviews = useServerFn(adminListReviews);
  const moderateReview = useServerFn(adminModerateReview);
  const deleteReview = useServerFn(adminDeleteReview);
  const qc = useQueryClient();

  const reviews = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => listReviews(),
  });

  const moderate = useMutation({
    mutationFn: (data: { id: string; approved: boolean }) => moderateReview({ data }),
    onSuccess: () => {
      toast.success("Avis mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteReview({ data: { id } }),
    onSuccess: () => {
      toast.success("Avis supprimé");
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pending = (reviews.data ?? []).filter((r: any) => !r.approved).length;

  return (
    <StaffShell title="Administration" requiredRole="admin">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Modération</span>
          <h1 className="font-display text-4xl mt-2">Avis clients</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Les avis restent invisibles sur le site tant qu'ils ne sont pas validés.
          </p>
        </div>
        <div className="rounded-full bg-clay px-4 py-2 text-sm text-espresso">
          {pending} en attente
        </div>
      </div>

      {reviews.isLoading ? (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
        </div>
      ) : (reviews.data ?? []).length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
          Aucun avis pour le moment.
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {(reviews.data ?? []).map((r: any) => (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-xl">{r.author_name}</h3>
                    <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-widest ${
                      r.approved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                    }`}>
                      {r.approved ? "Publié" : "En attente"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`w-4 h-4 ${n <= r.rating ? "fill-gold text-gold" : "text-border"}`} />
                    ))}
                    <span className="ml-2 text-xs text-muted-foreground">{r.product_slug}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!r.approved ? (
                    <button
                      onClick={() => moderate.mutate({ id: r.id, approved: true })}
                      className="inline-flex items-center gap-2 rounded-full bg-espresso px-3 py-2 text-xs text-cream hover:bg-copper"
                    >
                      <Check className="w-3.5 h-3.5" /> Valider
                    </button>
                  ) : (
                    <button
                      onClick={() => moderate.mutate({ id: r.id, approved: false })}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs hover:bg-clay"
                    >
                      <X className="w-3.5 h-3.5" /> Masquer
                    </button>
                  )}
                  <button
                    onClick={() => confirm("Supprimer cet avis ?") && remove.mutate(r.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-destructive/30 px-3 py-2 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer
                  </button>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-espresso/80">"{r.comment}"</p>
              {r.location && <p className="mt-2 text-xs text-muted-foreground">{r.location}</p>}
              {(r.before_image_url || r.after_image_url) && (
                <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
                  {r.before_image_url && <img src={r.before_image_url} alt="Avant" className="aspect-square rounded-xl object-cover" />}
                  {r.after_image_url && <img src={r.after_image_url} alt="Après" className="aspect-square rounded-xl object-cover" />}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </StaffShell>
  );
}
