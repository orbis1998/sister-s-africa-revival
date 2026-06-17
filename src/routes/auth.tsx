import { createFileRoute, Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Connexion — The Sisters Africa" }] }),
  component: AuthHub,
});

function AuthHub() {
  return (
    <div className="container-page py-20 min-h-[70vh]">
      <div className="max-w-2xl mx-auto text-center mb-12">
        <span className="eyebrow">Espace privé</span>
        <h1 className="font-display text-4xl md:text-5xl mt-3">Connectez-vous</h1>
        <p className="text-muted-foreground mt-4">
          Un seul accès pour les clients, managers, livreurs, POS et administrateurs.
          Votre espace sera ouvert automatiquement selon votre rôle.
        </p>
      </div>
      <Link to="/login" className="group block max-w-md mx-auto bg-card border border-border rounded-2xl p-8 hover:shadow-elegant transition-all">
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-copper/10 text-copper">
          <LogIn className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <h3 className="font-display text-2xl mt-4">Connexion</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Accédez à votre espace avec vos identifiants.
        </p>
        <span className="text-xs uppercase tracking-[0.22em] text-copper mt-5 inline-block group-hover:translate-x-1 transition">Se connecter →</span>
      </Link>
      <p className="text-center text-sm text-muted-foreground mt-10">
        Pas encore client ? <Link to="/signup" className="text-copper underline">Créer un compte</Link>
      </p>
    </div>
  );
}
