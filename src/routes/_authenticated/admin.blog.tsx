import { createFileRoute } from "@tanstack/react-router";
import { PublicPageContentAdmin } from "@/components/admin/PublicPageContentAdmin";

export const Route = createFileRoute("/_authenticated/admin/blog")({
  component: BlogAdminPage,
});

function BlogAdminPage() {
  return (
    <PublicPageContentAdmin
      config={{
        pagePrefix: "pos_page",
        pageTitle: "Points de vente",
        pageDescription: "Page publique /blog — en-tête, fiches magasins et articles conseils.",
        previewPath: "/blog",
        posCardsHint: "Fiches magasins : Admin → Magasins POS → Affichage public « Page points de vente ».",
        articleScope: "points_de_vente",
        articlesDescription: "Articles affichés en bas de la page points de vente.",
        queryKey: "admin-blog",
      }}
    />
  );
}
