import { createFileRoute } from "@tanstack/react-router";
import { StaffShell } from "@/components/admin/AdminLayout";
import { PublicPageEditor } from "@/components/admin/PublicPageEditor";

export const Route = createFileRoute("/_authenticated/admin/contact-page")({
  component: ContactPageAdmin,
});

function ContactPageAdmin() {
  return (
    <StaffShell title="Administration" requiredRole="admin">
      <span className="eyebrow">Contenu</span>
      <h1 className="font-display text-4xl mt-2">Page Contact</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
        Éditez le surtitre affiché sur la page publique /contact. Les fiches de contact se gèrent dans Magasins POS (affichage « Contact »).
      </p>
      <PublicPageEditor
        prefix="contact_page"
        title="En-tête de la page"
        description="Seul le surtitre est affiché sur le site — les 5 fiches contact apparaissent en dessous."
        previewPath="/contact"
        posCardsHint="Fiches : Admin → Magasins POS → Affichage public « Page contact »."
        showCtas={false}
      />
    </StaffShell>
  );
}
