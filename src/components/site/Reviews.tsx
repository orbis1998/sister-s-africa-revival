import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
import { getPublicReviews } from "@/lib/reviews.functions";
import type { PublicReview } from "@/lib/reviews";

export function Reviews({
  productSlug,
  refreshKey,
  initialReviews = [],
}: {
  productSlug: string;
  refreshKey: number;
  initialReviews?: PublicReview[];
}) {
  const getReviews = useServerFn(getPublicReviews);
  const { data: reviews = initialReviews, isLoading } = useQuery({
    queryKey: ["public-reviews", productSlug, refreshKey],
    queryFn: () => getReviews({ data: { productSlug, limit: 50 } }),
    initialData: initialReviews,
    placeholderData: (prev) => prev ?? initialReviews,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });

  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  if (isLoading && reviews.length === 0) {
    return <div className="text-sm text-muted-foreground">Chargement des avis…</div>;
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-8 pb-6 border-b border-border">
        <div>
          <div className="eyebrow mb-2">Témoignages</div>
          <h3 className="font-display text-3xl text-espresso">Ce que disent nos clientes</h3>
        </div>
        {reviews.length > 0 && (
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`w-4 h-4 ${n <= Math.round(avg) ? "fill-gold text-gold" : "text-border"}`}
                />
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {avg.toFixed(1)} / 5 · {reviews.length} avis
            </div>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-12 bg-clay/30 rounded-sm">
          <p className="text-muted-foreground italic">
            Soyez la première à partager votre expérience.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {reviews.map((r) => (
            <article key={r.id} className="bg-card p-6 rounded-sm border border-border/60">
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`w-3.5 h-3.5 ${n <= r.rating ? "fill-gold text-gold" : "text-border"}`}
                  />
                ))}
              </div>
              <p className="text-sm text-espresso/85 leading-relaxed mb-4 italic">&quot;{r.comment}&quot;</p>
              {(r.before_image_url || r.after_image_url) && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {r.before_image_url && (
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Avant</div>
                      <img src={r.before_image_url} alt="Avant" className="w-full aspect-square object-cover rounded-sm" />
                    </div>
                  )}
                  {r.after_image_url && (
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-copper mb-1">Après</div>
                      <img src={r.after_image_url} alt="Après" className="w-full aspect-square object-cover rounded-sm" />
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-espresso">{r.author_name}</span>
                {r.location && <span className="text-muted-foreground">{r.location}</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
