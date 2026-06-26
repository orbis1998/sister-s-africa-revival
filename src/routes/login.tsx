import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resolveStaffBadgeLogin } from "@/lib/auth.functions";
import { roleHome, type AppRole, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Connexion — The Sisters Africa" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { refreshRoles } = useAuth();
  const resolveBadge = useServerFn(resolveStaffBadgeLogin);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const rawIdentifier = identifier.trim();
    let loginEmail = rawIdentifier;
    if (!rawIdentifier.includes("@")) {
      try {
        const resolved = await resolveBadge({ data: { badge_id: rawIdentifier } });
        loginEmail = (resolved as any).email;
      } catch (err: any) {
        toast.error(err?.message ?? "Badge invalide");
        setLoading(false);
        return;
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
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
          Utilisez votre email ou votre badge staff dans le même champ. Votre rôle sera détecté automatiquement.
        </p>
        <form onSubmit={onSubmit} className="space-y-4 mt-6">
          <div>
            <label className="text-xs uppercase tracking-widest">Email ou badge</label>
            <input
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email ou badge staff"
              className="mt-1 w-full px-3 py-2 border border-border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest">Mot de passe</label>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-border rounded bg-background"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-espresso"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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
