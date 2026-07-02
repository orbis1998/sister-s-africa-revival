import { Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Phone } from "lucide-react";
import type { BlogPostPublic } from "@/lib/blog";
import { blogPostPathKey } from "@/lib/blog";
type PageDisplayCard = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  public_note: string | null;
};

export type CmsPageHeroConfig = {
  eyebrow: string;
  title: string;
  ctaLabel: string;
  ctaHref: string;
  ctaSecondaryLabel: string;
  whatsappNumber: string;
};

function BlogArticleCard({ article, index }: { article: BlogPostPublic; index: number }) {
  const articleKey = blogPostPathKey(article);
  return (
    <Link
      to="/article/$slug"
      params={{ slug: articleKey }}
      className="group block overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-elegant"
    >
      <div className="grid min-h-full sm:grid-cols-[0.38fr_0.62fr]">
        <div className="relative flex min-h-56 flex-col justify-between bg-espresso p-7 text-cream">
          {article.cover_image_url ? (
            <img src={article.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(216,166,92,0.28),transparent_36%)]" />
          )}
          <div className="relative text-xs uppercase tracking-[0.22em] text-gold">{article.category}</div>
          <div className="relative font-display text-7xl text-cream/90">{String(index + 1).padStart(2, "0")}</div>
        </div>
        <div className="flex flex-col p-7">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{article.read_time}</div>
          <h2 className="mt-3 font-display text-3xl text-espresso transition group-hover:text-copper">{article.title}</h2>
          <p className="mt-4 flex-1 text-sm leading-relaxed text-espresso/75">{article.excerpt}</p>
          <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-copper/30 px-4 py-2 text-xs uppercase tracking-[0.18em] text-copper transition group-hover:bg-copper group-hover:text-cream">
            En savoir plus <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function PosCardsGrid({ points, compact = false }: { points: PageDisplayCard[]; compact?: boolean }) {
  if (!points.length) return null;
  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${compact ? "mt-6" : "mt-14"}`}>
      {points.map((pos) => (
        <article key={pos.id} className="rounded-2xl border border-cream/10 bg-cream/[0.06] p-6 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.2em] text-gold">{pos.city ?? "Point de vente"}</div>
          <h2 className="mt-2 font-display text-2xl text-cream">{pos.name}</h2>
          {pos.public_note && <p className="mt-3 text-sm leading-relaxed text-cream/75">{pos.public_note}</p>}
          {pos.address && (
            <p className="mt-3 flex items-start gap-2 text-sm text-cream/80">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              {pos.address}
            </p>
          )}
          {pos.phone && (
            <a href={`tel:${pos.phone.replace(/\s/g, "")}`} className="mt-2 inline-flex items-center gap-2 text-sm text-cream/90 hover:text-gold">
              <Phone className="h-4 w-4" /> {pos.phone}
            </a>
          )}
        </article>
      ))}
    </div>
  );
}

export function CmsPublicPage({
  hero,
  pointsOfSale,
  posts,
  showArticles = true,
  hideTitle = false,
  hideCtas = false,
}: {
  hero: CmsPageHeroConfig;
  pointsOfSale: PageDisplayCard[];
  posts: BlogPostPublic[];
  showArticles?: boolean;
  hideTitle?: boolean;
  hideCtas?: boolean;
}) {
  const whatsappHref = `https://wa.me/${hero.whatsappNumber.replace(/\D/g, "")}`;
  const hasHeroText = !hideTitle || !hideCtas;

  return (
    <>
      <section className="bg-espresso text-cream">
        <div className="container-page py-20 md:py-28">
          {hasHeroText && (
            <div className="max-w-3xl">
              <div className="eyebrow mb-4 text-gold">{hero.eyebrow}</div>
              {!hideTitle && (
                <h1 className="font-display text-5xl leading-tight md:text-7xl">{hero.title}</h1>
              )}
              {!hideCtas && (
                <div className={`flex flex-wrap gap-3 ${hideTitle ? "mt-0" : "mt-8"}`}>
                  <Link
                    to={hero.ctaHref as any}
                    className="inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-espresso hover:bg-gold"
                  >
                    {hero.ctaLabel} <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-cream/20 px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-cream/90 hover:bg-cream/10"
                  >
                    {hero.ctaSecondaryLabel}
                  </a>
                </div>
              )}
            </div>
          )}
          {!hasHeroText && hero.eyebrow && (
            <div className="eyebrow mb-6 text-gold">{hero.eyebrow}</div>
          )}
          <PosCardsGrid points={pointsOfSale} compact={hideTitle && hideCtas} />
        </div>
      </section>

      {showArticles && posts.length > 0 && (
        <section className="relative z-10 container-page py-20 md:py-24">
          <div className="grid gap-6 lg:grid-cols-2">
            {posts.map((article, index) => (
              <BlogArticleCard key={article.id} article={article} index={index} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
