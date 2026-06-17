import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Inscription — The Sisters Africa" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/account`,
        data: { full_name: form.full_name, phone: form.phone },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Compte créé. Vérifiez vos emails si confirmation requise.");
    navigate({ to: "/account" });
  };

  return (
    <div className="container-page py-20 min-h-[70vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8">
        <span className="eyebrow">Inscription</span>
        <h1 className="font-display text-3xl mt-2">Créer un compte client</h1>
        <form onSubmit={onSubmit} className="space-y-4 mt-6">
          <input required placeholder="Nom complet" value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded bg-background" />
          <input required placeholder="Téléphone" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded bg-background" />
          <input type="email" required placeholder="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded bg-background" />
          <input type="password" required minLength={6} placeholder="Mot de passe (6+ caractères)"
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded bg-background" />
          <button disabled={loading} className="btn-hero w-full">
            {loading ? "Création…" : "Créer mon compte"}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Déjà un compte ? <Link to="/login/$role" params={{ role: "client" }} className="text-copper underline">Connexion</Link>
        </p>
      </div>
    </div>
  );
}
