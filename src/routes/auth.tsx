import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Truck, Briefcase, User } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Connexion — The Sisters Africa" }] }),
  component: AuthHub,
});

const roles = [
  { to: "/login/client", icon: User, title: "Client", desc: "Suivez vos commandes et avis", accent: "bg-copper/10 text-copper" },
  { to: "/login/admin", icon: Shield, title: "Administrateur", desc: "Centralisation complète", accent: "bg-espresso/10 text-espresso" },
  { to: "/login/manager", icon: Briefcase, title: "Manager", desc: "Permissions définies par l'admin", accent: "bg-gold/20 text-espresso" },
  { to: "/login/livreur", icon: Truck, title: "Livreur", desc: "Accès aux courses du jour", accent: "bg-clay text-espresso" },
] as const;

function AuthHub() {
  return (
    <div className="container-page py-20 min-h-[70vh]">
      <div className="max-w-2xl mx-auto text-center mb-12">
        <span className="eyebrow">Espace privé</span>
        <h1 className="font-display text-4xl md:text-5xl mt-3">Connectez-vous</h1>
        <p className="text-muted-foreground mt-4">
          Choisissez votre type de compte. Les comptes Manager, Livreur et Admin sont créés par l'administration.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
        {roles.map((r) => (
          <Link key={r.to} to={r.to} className="group bg-card border border-border rounded-2xl p-6 hover:shadow-elegant transition-all">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${r.accent}`}>
              <r.icon className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <h3 className="font-display text-xl mt-4">{r.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{r.desc}</p>
            <span className="text-xs uppercase tracking-[0.22em] text-copper mt-4 inline-block group-hover:translate-x-1 transition">Se connecter →</span>
          </Link>
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground mt-10">
        Pas encore client ? <Link to="/signup" className="text-copper underline">Créer un compte</Link>
      </p>
    </div>
  );
}
