import { createFileRoute } from "@tanstack/react-router";
import { CmsPublicPage } from "@/components/site/CmsPublicPage";
import { fetchPublicPointsOfSale } from "@/lib/public-pos";
import { buildSeoMeta } from "@/lib/seo";
import { defaultSiteSettings, fetchSiteSettings } from "@/lib/site-settings";

export const Route = createFileRoute("/contact")({
  head: () => buildSeoMeta({
    title: "Contact — The Sisters Africa",
    description: "Nos bureaux et points de contact The Sisters Africa à Brazzaville, Kinshasa, Kolwezi, Lubumbashi et Pointe-Noire.",
    url: "https://thesistersafrica.com/contact",
    type: "website",
  }),
  loader: async () => {
    const [settings, pointsOfSale] = await Promise.all([
      fetchSiteSettings().catch(() => defaultSiteSettings),
      fetchPublicPointsOfSale("contact").catch(() => []),
    ]);
    return { settings, pointsOfSale };
  },
  component: ContactPage,
});

function ContactPage() {
  const { settings, pointsOfSale } = Route.useLoaderData();

  return (
    <CmsPublicPage
      hero={{
        eyebrow: settings.contact_page_eyebrow,
        title: settings.contact_page_title,
        ctaLabel: settings.pos_page_cta_label,
        ctaHref: settings.pos_page_cta_href,
        ctaSecondaryLabel: settings.pos_page_cta_secondary_label,
        whatsappNumber: settings.whatsapp_number,
      }}
      pointsOfSale={pointsOfSale}
      posts={[]}
      showArticles={false}
      hideTitle
      hideCtas
    />
  );
}
