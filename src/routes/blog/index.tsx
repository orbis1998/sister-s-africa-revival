import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Leaf, Sparkles } from "lucide-react";
import { fetchPublishedBlogPosts } from "@/lib/blog";
import { buildSeoMeta } from "@/lib/seo";

export const Route = createFileRoute("/blog/")({
  head: () => buildSeoMeta({
    title: "Blog & conseils — The Sisters Africa",
    description: "Guides, conseils et informations utiles pour comprendre les bouillies bio The Sisters Africa, la prise de poids saine et l'accompagnement client.",
    url: "https://thesistersafrica.com/blog",
    type: "website",
  }),
  loader: async () => {
    const posts = await fetchPublishedBlogPosts();
    return { posts };
  },
  component: BlogPage,
});

function BlogPage() {
  const { posts } = Route.useLoaderData();

  return (
    <>
      <section className="bg-espresso text-cream">
        <div className="container-page py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="eyebrow mb-4 text-gold">Blog & conseils</div>
            <h1 className="font-display text-5xl leading-tight md:text-7xl">
              Mieux comprendre nos produits avant de commander.
            </h1>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/products" className="inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-espresso hover:bg-gold">
                Découvrir les produits <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-2 rounded-full border border-cream/20 px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-cream/90 hover:bg-cream/10">
                Parler à l'équipe
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-18 md:py-24">
        <div className="mb-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: Leaf, title: "Origine végétale", text: "Bouillies bio d'origine végétale pour adultes et enfants." },
            { icon: Sparkles, title: "Prise de poids saine", text: "Des routines pensées pour soutenir l'appétit et l'assimilation." },
            { icon: BookOpen, title: `${posts.length} contenus`, text: "Articles éditables depuis le dashboard admin." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <Icon className="mb-4 h-5 w-5 text-copper" />
              <h2 className="font-display text-xl text-espresso">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {posts.map((article, index) => (
            <Link
              key={article.id}
              to="/blog/$slug"
              params={{ slug: article.slug }}
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
                <div className="p-7">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{article.read_time}</div>
                  <h2 className="mt-3 font-display text-3xl text-espresso group-hover:text-copper">{article.title}</h2>
                  <p className="mt-4 text-sm leading-relaxed text-espresso/75">{article.excerpt}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-copper">
                    Lire l'article <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
