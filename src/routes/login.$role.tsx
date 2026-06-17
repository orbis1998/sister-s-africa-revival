import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABEL, roleHome, type AppRole } from "@/lib/auth";

const validRoles: AppRole[] = ["client", "admin", "manager", "livreur"];

export const Route = createFileRoute("/login/$role")({
  component: LoginPage,
});

function LoginPage() {
  const { role } = Route.useParams();
  const navigate = useNavigate();
  const { refreshRoles } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!validRoles.includes(role as AppRole)) {
    return <div className="container-page py-20 text-center">Rôle invalide.</div>;
  }
  const r = role as AppRole;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error(error.message); setLoading(false); return; }
    // Verify role
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const list = (roles ?? []).map((x) => x.role) as AppRole[];
    if (!list.includes(r)) {
      await supabase.auth.signOut();
      toast.error(`Ce compte n'a pas le rôle ${ROLE_LABEL[r]}.`);
      setLoading(false);
      return;
    }
    await refreshRoles();
    toast.success("Connexion réussie");
    navigate({ to: roleHome(list) });
  };

  return (
    <div className="container-page py-20 min-h-[70vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8">
        <span className="eyebrow">Connexion</span>
        <h1 className="font-display text-3xl mt-2">Espace {ROLE_LABEL[r]}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {r === "client"
            ? "Connectez-vous pour suivre vos commandes."
            : "Identifiants fournis par l'administration."}
        </p>
        <form onSubmit={onSubmit} className="space-y-4 mt-6">
          <div>
            <label className="text-xs uppercase tracking-widest">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-border rounded bg-background" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest">Mot de passe</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-border rounded bg-background" />
          </div>
          <button disabled={loading} className="btn-hero w-full">
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <div className="mt-6 text-center text-sm text-muted-foreground space-y-2">
          {r === "client" && (
            <p>Pas de compte ? <Link to="/signup" className="text-copper underline">Inscription</Link></p>
          )}
          <p><Link to="/auth" className="underline">← Autre type de compte</Link></p>
        </div>
      </div>
    </div>
  );
}
