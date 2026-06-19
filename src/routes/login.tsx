import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  const [mode, setMode] = useState<"email" | "badge">("email");
  const [email, setEmail] = useState("");
  const [badge, setBadge] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let loginEmail = email.trim();
    if (mode === "badge") {
      try {
        const resolved = await resolveBadge({ data: { badge_id: badge } });
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
          Utilisez votre email ou votre badge staff. Votre rôle sera détecté automatiquement après connexion.
        </p>
        <form onSubmit={onSubmit} className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-2 rounded-full bg-clay/60 p-1 text-xs uppercase tracking-widest">
            <button
              type="button"
              onClick={() => setMode("email")}
              className={`rounded-full px-3 py-2 transition ${mode === "email" ? "bg-espresso text-cream" : "text-espresso/70"}`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setMode("badge")}
              className={`rounded-full px-3 py-2 transition ${mode === "badge" ? "bg-espresso text-cream" : "text-espresso/70"}`}
            >
              Badge staff
            </button>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest">{mode === "email" ? "Email" : "Badge"}</label>
            {mode === "email" ? (
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-border rounded bg-background"
              />
            ) : (
              <input
                required
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="Ex. MAN-KIN-001"
                className="mt-1 w-full px-3 py-2 border border-border rounded bg-background uppercase"
              />
            )}
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
