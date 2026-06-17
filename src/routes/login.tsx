import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { roleHome, type AppRole, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Connexion — The Sisters Africa" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { refreshRoles } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);

    setLoading(false);
    if (roleError) {
      toast.error(roleError.message);
      return;
    }

    const list = (roles ?? []).map((x) => x.role) as AppRole[];
    await refreshRoles();
    toast.success("Connexion réussie");
    navigate({ to: roleHome(list) });
  };

  return (
    <div className="container-page py-20 min-h-[70vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8">
        <span className="eyebrow">Connexion</span>
        <h1 className="font-display text-3xl mt-2">Accéder à mon espace</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Utilisez vos identifiants. Votre rôle sera détecté automatiquement après connexion.
        </p>
        <form onSubmit={onSubmit} className="space-y-4 mt-6">
          <div>
            <label className="text-xs uppercase tracking-widest">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-border rounded bg-background"
            />
          </div>
          <button disabled={loading} className="btn-hero w-full">
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Pas encore client ? <Link to="/signup" className="text-copper underline">Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}
