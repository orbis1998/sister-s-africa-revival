import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth, ROLE_LABEL } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="container-page py-20 min-h-[60vh]">
      <span className="eyebrow">Mon espace</span>
      <h1 className="font-display text-4xl mt-2">Bonjour</h1>
      <p className="text-muted-foreground mt-2">{user?.email}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {roles.map((r) => (
          <span key={r} className="px-3 py-1 rounded-full bg-clay text-xs uppercase tracking-widest">{ROLE_LABEL[r]}</span>
        ))}
      </div>
      <div className="mt-10 grid sm:grid-cols-2 gap-4 max-w-2xl">
        <div className="border border-border rounded-2xl p-6 bg-card">
          <h3 className="font-display text-xl">Mes commandes</h3>
          <p className="text-sm text-muted-foreground mt-1">Suivi WhatsApp — contactez-nous pour le statut.</p>
        </div>
        <div className="border border-border rounded-2xl p-6 bg-card">
          <h3 className="font-display text-xl">Mes avis</h3>
          <p className="text-sm text-muted-foreground mt-1">Partagez votre expérience depuis chaque page produit.</p>
        </div>
      </div>
      <button className="btn-ghost mt-10" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
        Se déconnecter
      </button>
    </div>
  );
}
