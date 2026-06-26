import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { fetchBlogPostBySlugPublic } from "@/lib/blog";
import { RichContent } from "@/components/site/RichContent";
import { buildSeoMeta } from "@/lib/seo";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/blog/$slug")({
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    return buildSeoMeta({
      title: post?.seo_title || `${post?.title ?? "Article"} — Blog The Sisters Africa`,
      description: post?.seo_description || post?.excerpt || "Conseils et guides The Sisters Africa.",
      image: post?.cover_image_url ?? undefined,
      url: `https://thesistersafrica.com/blog/${post?.slug ?? ""}`,
      type: "article",
    });
  },
  loader: async ({ params }) => {
    const post = await fetchBlogPostBySlugPublic(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  notFoundComponent: () => (
    <div className="container-page py-32 text-center">
      <h1 className="font-display text-4xl text-espresso mb-4">Article introuvable</h1>
      <Link to="/blog/" className="btn-hero mt-4">Retour aux points de vente</Link>
    </div>
  ),
  component: BlogPostPage,
});

function BlogPostPage() {
  const { post } = Route.useLoaderData();

  return (
    <>
      <section className="bg-espresso text-cream">
        <div className="container-page py-16 md:py-24">
          <Link to="/blog/" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cream/70 hover:text-gold">
            <ArrowLeft className="h-3.5 w-3.5" /> Points de vente
          </Link>
          <div className="mt-6 max-w-3xl">
            <div className="text-xs uppercase tracking-[0.22em] text-gold">{post.category}</div>
            <h1 className="mt-4 font-display text-5xl leading-tight md:text-6xl">{post.title}</h1>
            <p className="mt-4 text-cream/75">{post.excerpt}</p>
            <div className="mt-4 text-xs uppercase tracking-[0.18em] text-cream/50">{post.read_time}</div>
          </div>
        </div>
      </section>

      {post.cover_image_url && (
        <div className="container-page -mt-10">
          <img src={post.cover_image_url} alt={post.title} className="aspect-[21/9] w-full rounded-3xl object-cover shadow-elegant" />
        </div>
      )}

      <section className="container-page py-16 md:py-20">
        <div className="mx-auto max-w-3xl">
          <RichContent html={post.content_html} className="prose-base" />
        </div>
      </section>
    </>
  );
}
