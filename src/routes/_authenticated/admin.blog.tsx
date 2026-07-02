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
        pageDescription: "Page publique /blog — en-tête, fiches et articles conseils. Contenu indépendant de la page Expédition.",
        previewPath: "/blog",
        fichesDescription: "Cartes affichées en haut de la page points de vente. Indépendantes de la page expédition.",
        articleScope: "points_de_vente",
        articlesDescription: "Articles affichés en bas de la page points de vente.",
        queryKey: "admin-blog",
      }}
    />
  );
}
