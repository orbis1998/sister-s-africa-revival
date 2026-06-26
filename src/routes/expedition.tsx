import { createFileRoute } from "@tanstack/react-router";
import { CmsPublicPage } from "@/components/site/CmsPublicPage";
import { fetchPublishedBlogPosts } from "@/lib/blog";
import { fetchPublicPointsOfSale } from "@/lib/public-pos";
import { buildSeoMeta } from "@/lib/seo";
import { defaultSiteSettings, fetchSiteSettings } from "@/lib/site-settings";

export const Route = createFileRoute("/expedition")({
  head: () => buildSeoMeta({
    title: "Expédition — The Sisters Africa",
    description: "Découvrez nos zones d'expédition et nos guides pour commander The Sisters Africa partout en Afrique centrale.",
    url: "https://thesistersafrica.com/expedition",
    type: "website",
  }),
  loader: async () => {
    const [posts, settings, pointsOfSale] = await Promise.all([
      fetchPublishedBlogPosts("expedition"),
      fetchSiteSettings().catch(() => defaultSiteSettings),
      fetchPublicPointsOfSale("expedition").catch(() => []),
    ]);
    return { posts, settings, pointsOfSale };
  },
  component: ExpeditionPage,
});

function ExpeditionPage() {
  const { posts, settings, pointsOfSale } = Route.useLoaderData();

  return (
    <CmsPublicPage
      hero={{
        eyebrow: settings.expedition_page_eyebrow,
        title: settings.expedition_page_title,
        ctaLabel: settings.expedition_page_cta_label,
        ctaHref: settings.expedition_page_cta_href,
        ctaSecondaryLabel: settings.expedition_page_cta_secondary_label,
        whatsappNumber: settings.whatsapp_number,
      }}
      pointsOfSale={pointsOfSale}
      posts={posts}
    />
  );
}
