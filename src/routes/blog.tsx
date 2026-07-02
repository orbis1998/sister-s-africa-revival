import { createFileRoute } from "@tanstack/react-router";
import { CmsPublicPage } from "@/components/site/CmsPublicPage";
import { fetchPublishedBlogPosts } from "@/lib/blog";
import { fetchPublicPageFiches } from "@/lib/page-fiches";
import { buildSeoMeta } from "@/lib/seo";
import { defaultSiteSettings, fetchSiteSettings } from "@/lib/site-settings";

export const Route = createFileRoute("/blog")({
  head: () => buildSeoMeta({
    title: "Points de vente & conseils — The Sisters Africa",
    description: "Retrouvez nos points de vente partenaires et nos guides pour comprendre les bouillies bio The Sisters Africa.",
    url: "https://thesistersafrica.com/blog",
    type: "website",
  }),
  loader: async () => {
    const [posts, settings, pointsOfSale] = await Promise.all([
      fetchPublishedBlogPosts("points_de_vente"),
      fetchSiteSettings().catch(() => defaultSiteSettings),
      fetchPublicPageFiches("points_de_vente").catch(() => []),
    ]);
    return { posts, settings, pointsOfSale };
  },
  component: BlogPage,
});

function BlogPage() {
  const { posts, settings, pointsOfSale } = Route.useLoaderData();

  return (
    <CmsPublicPage
      hero={{
        eyebrow: settings.pos_page_eyebrow,
        title: settings.pos_page_title,
        ctaLabel: settings.pos_page_cta_label,
        ctaHref: settings.pos_page_cta_href,
        ctaSecondaryLabel: settings.pos_page_cta_secondary_label,
        whatsappNumber: settings.whatsapp_number,
      }}
      pointsOfSale={pointsOfSale}
      posts={posts}
    />
  );
}
