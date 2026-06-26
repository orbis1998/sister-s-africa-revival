import { createFileRoute } from "@tanstack/react-router";
import { PublicPageContentAdmin } from "@/components/admin/PublicPageContentAdmin";

export const Route = createFileRoute("/_authenticated/admin/expedition-page")({
  component: ExpeditionPageAdmin,
});

function ExpeditionPageAdmin() {
  return (
    <PublicPageContentAdmin
      config={{
        pagePrefix: "expedition_page",
        pageTitle: "Expédition",
        pageDescription: "Page publique /expedition — en-tête, fiches et articles.",
        previewPath: "/expedition",
        posCardsHint: "Fiches expédition : Admin → Magasins POS → Affichage public « Page expédition ».",
        articleScope: "expedition",
        articlesDescription: "Articles affichés en bas de la page expédition.",
        queryKey: "admin-expedition",
      }}
    />
  );
}
