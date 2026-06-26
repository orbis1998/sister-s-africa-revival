import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero.jpg";
import { fetchFeaturedProducts } from "@/lib/products";
import { fetchApprovedReviews, type PublicReview } from "@/lib/reviews";
import { defaultSiteSettings, fetchSiteSettings, type SiteSettings } from "@/lib/site-settings";
import { ProductCard } from "@/components/site/ProductCard";
import { ArrowRight, Leaf, ShieldCheck, Truck, HeartHandshake, Star } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Sisters Africa — Bouillies bio pour une prise de poids saine" },
      { name: "description", content: "Mass Gainer, Super Grow et Peanut Butter — bouillies bio pour adultes et enfants. Livraison RDC & Congo Brazzaville." },
      { property: "og:title", content: "The Sisters Africa" },
      { property: "og:image", content: heroImg },
    ],
  }),
  loader: async () => {
    try {
      const [products, settings, reviews] = await Promise.all([
        fetchFeaturedProducts().catch((error) => {
          console.error("Featured products loader failed", error);
          return [];
        }),
        fetchSiteSettings().catch((error) => {
          console.error("Site settings loader failed", error);
          return defaultSiteSettings;
        }),
        fetchApprovedReviews({ limit: 4 }).catch((error) => {
          console.error("Home reviews loader failed", error);
          return [];
        }),
      ]);
      return { products, settings, reviews };
    } catch (error) {
      console.error("Home loader failed", error);
      return { products: [], settings: defaultSiteSettings, reviews: [] };
    }
  },
  component: HomePage,
});

function HomePage() {
  const { products, settings, reviews } = Route.useLoaderData();

  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-[88vh] items-center overflow-hidden bg-espresso text-cream">
        <HeroSlider images={settings.hero_images} />
        <div className="absolute inset-0 bg-gradient-to-r from-espresso/92 via-espresso/78 to-espresso/55" aria-hidden />
        <div className="relative z-10 container-page py-14 sm:py-18 lg:py-24 max-w-2xl">
          <div className="eyebrow text-gold mb-5">{settings.hero_eyebrow}</div>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl leading-[1.05] mb-7">
            <HeroTitle settings={settings} />
          </h1>
          <p className="text-base text-cream/85 leading-relaxed max-w-md mb-9">
            {settings.hero_subtitle}
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to={settings.cta_href as any} className="inline-flex items-center justify-center gap-2 rounded-full bg-cream px-7 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-espresso shadow-elegant transition hover:bg-gold">
              {settings.cta_label} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-4 border-t border-cream/20 pt-7 text-[11px] text-cream/70">
            <div><strong className="font-display text-cream text-2xl block leading-none">10K+</strong> clientes</div>
            <div><strong className="font-display text-cream text-2xl block leading-none">3-6kg</strong> en 2 sem.</div>
            <div><strong className="font-display text-cream text-2xl block leading-none">100%</strong> bio végétal</div>
          </div>
        </div>
      </section>

      {/* FEATURES STRIP */}
      <section className="border-y border-border/60 bg-clay/30">
        <div className="container-page grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
          {[
            { icon: Leaf, label: "100% bio végétal" },
            { icon: ShieldCheck, label: "Résultats garantis" },
            { icon: Truck, label: "Livraison RDC & Congo" },
            { icon: HeartHandshake, label: "Service client humain" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="bg-clay/30 px-6 py-6 flex items-center gap-3">
              <Icon className="w-5 h-5 text-copper" strokeWidth={1.5} />
              <span className="text-xs uppercase tracking-[0.18em] text-espresso/80">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* BEST SELLERS */}
      <section className="container-page py-24">
        <div className="flex items-end justify-between mb-14">
          <div>
            <div className="eyebrow mb-3">Best-sellers</div>
            <h2 className="font-display text-4xl md:text-5xl text-espresso">Nos formules signature</h2>
          </div>
          <Link to="/products" className="hidden md:inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-espresso hover:text-copper">
            Tout voir <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {products.length === 0 ? (
          <div className="rounded-sm border border-border bg-card p-12 text-center text-muted-foreground">
            Aucun best-seller actif pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {products.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* STORY */}
      <section className="bg-espresso text-cream py-24">
        <div className="container-page grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="eyebrow text-gold mb-4">{settings.story_eyebrow}</div>
            <h2 className="font-display text-4xl md:text-5xl mb-6 leading-tight">
              {settings.story_title}
            </h2>
            <p className="text-cream/80 leading-relaxed mb-4">
              {settings.story_paragraph_1}
            </p>
            <p className="text-cream/80 leading-relaxed">
              {settings.story_paragraph_2}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {(settings.home_stats ?? []).slice(0, 4).map((item, index) => (
              <div
                key={item.label}
                className={`group relative overflow-hidden rounded-3xl border border-cream/10 bg-cream/[0.06] p-6 shadow-elegant backdrop-blur transition hover:-translate-y-1 hover:bg-cream/[0.1] sm:p-8 ${
                  index % 2 === 1 ? "mt-10" : ""
                }`}
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gold/15 blur-2xl transition group-hover:bg-gold/25" />
                <div className="relative">
                  <div className="font-display text-4xl text-gold mb-3 sm:text-5xl">{item.value}</div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-cream/70">{item.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HomeReviews reviews={reviews} />

      {/* CTA */}
      <section className="container-page py-24 text-center">
        <div className="eyebrow mb-4">Service client</div>
        <h2 className="font-display text-4xl md:text-5xl text-espresso mb-6">
          The Sisters got your back.
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-10">
          Notre équipe vous accompagne par WhatsApp, de la commande à la livraison.
        </p>
        <Link to="/products" className="btn-hero">Commencer ma transformation</Link>
      </section>
    </>
  );
}

function HomeReviews({ reviews }: { reviews: PublicReview[] }) {
  return (
    <section className="container-page py-24">
      <div className="mb-12 max-w-2xl">
        <div className="eyebrow mb-3">Avis validés</div>
        <h2 className="font-display text-4xl text-espresso md:text-5xl">Elles ont testé nos formules</h2>
        <p className="mt-4 text-muted-foreground">
          Chaque témoignage publié a été vérifié par notre équipe avant d'apparaître ici.
        </p>
      </div>
      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
          Aucun avis validé pour le moment. Les témoignages apparaîtront ici après validation par l'administration.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-4 w-4 ${n <= review.rating ? "fill-gold text-gold" : "text-border"}`} />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-espresso/80 italic">&quot;{review.comment}&quot;</p>
              <div className="mt-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {review.author_name}{review.location ? ` · ${review.location}` : ""}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function HeroTitle({ settings }: { settings: SiteSettings }) {
  const parts = settings.hero_title.split(settings.hero_highlight);
  if (!settings.hero_highlight || parts.length === 1) return <>{settings.hero_title}</>;
  return (
    <>
      {parts[0]}
      <em className="text-gold not-italic">{settings.hero_highlight}</em>
      {parts.slice(1).join(settings.hero_highlight)}
    </>
  );
}

function HeroSlider({ images }: { images: string[] }) {
  const safeImages = images.length ? images.slice(0, 3) : [heroImg];
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (safeImages.length < 2) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % safeImages.length), 4500);
    return () => window.clearInterval(id);
  }, [safeImages.length]);

  return (
    <div className="absolute inset-0" aria-hidden>
      {safeImages.map((src, index) => (
        <img
          key={`${src}-${index}`}
          src={src}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            index === active ? "opacity-100" : "opacity-0"
          }`}
          width={1600}
          height={1200}
        />
      ))}
      {safeImages.length > 1 && (
        <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {safeImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setActive(index)}
              className={`h-2 rounded-full transition-all ${index === active ? "w-8 bg-gold" : "w-2 bg-cream/60"}`}
              aria-label={`Voir l'image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
