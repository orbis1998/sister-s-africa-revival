import { Star } from "lucide-react";
import type { PublicReview } from "@/lib/reviews";

function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 drop-shadow-sm ${
            n <= rating
              ? "fill-gold text-gold [filter:drop-shadow(0_1px_6px_oklch(0.78_0.10_80_/_0.45))]"
              : "text-border/80"
          }`}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

export function ReviewMarqueeCard({ review }: { review: PublicReview }) {
  return (
    <article className="group relative w-[min(88vw,22rem)] shrink-0 overflow-hidden rounded-3xl border border-gold/15 bg-gradient-to-br from-card via-card to-clay/35 p-6 shadow-[0_18px_50px_-28px_oklch(0.45_0.13_40_/_0.45)] transition duration-500 hover:-translate-y-1 hover:border-gold/30 sm:w-[24rem] sm:p-7">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold/10 blur-2xl transition group-hover:bg-gold/20" />
      <div className="relative">
        <div className="mb-4">
          <ReviewStars rating={review.rating} />
        </div>
        <p className="text-sm leading-relaxed text-espresso/90">{review.comment}</p>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-espresso">
            {review.author_name}
          </div>
          {review.location && (
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {review.location}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function ReviewsMarquee({ reviews }: { reviews: PublicReview[] }) {
  const marqueeReviews = reviews.length > 1 ? [...reviews, ...reviews] : reviews;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background via-background/90 to-transparent sm:w-28" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background via-background/90 to-transparent sm:w-28" />
      <div className="reviews-marquee-track flex w-max gap-5 px-5 sm:gap-6 sm:px-6">
        {marqueeReviews.map((review, index) => (
          <ReviewMarqueeCard key={`${review.id}-${index}`} review={review} />
        ))}
      </div>
    </div>
  );
}
