import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { StaffShell } from "@/components/admin/AdminLayout";
import { adminCreateUser, adminListUsers, adminDeleteUser } from "@/lib/admin.functions";
import { Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

const permKeys = [
  ["can_manage_products", "Produits"],
  ["can_manage_stock", "Stock"],
  ["can_manage_orders", "Commandes"],
  ["can_manage_logistics", "Logistique"],
  ["can_view_accounting", "Comptabilité"],
  ["can_manage_pos", "POS"],
  ["can_manage_users", "Utilisateurs"],
] as const;

function UsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListUsers);
  const createFn = useServerFn(adminCreateUser);
  const deleteFn = useServerFn(adminDeleteUser);
  const { data: users = [], isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => listFn({}) });
  const { data: posList = [] } = useQuery({
    queryKey: ["admin-pos-for-users"],
    queryFn: async () => (await supabase.from("points_of_sale").select("id,name,city").order("name")).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    email: "", password: "", full_name: "", phone: "", badge_id: "",
    role: "livreur", permissions: {}, pos_id: "",
  });

  const createMut = useMutation({
    mutationFn: (data: any) => createFn({ data }),
    onSuccess: () => { toast.success("Compte créé"); setOpen(false); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (user_id: string) => deleteFn({ data: { user_id } }),
    onSuccess: () => { toast.success("Compte supprimé"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });

  return (
    <StaffShell title="Administration" requiredRole="admin">
      <div className="flex justify-between items-end">
        <div>
          <span className="eyebrow">Équipe</span>
          <h1 className="font-display text-4xl mt-2">Utilisateurs</h1>
        </div>
        <button onClick={() => setOpen(true)} className="btn-hero"><Plus className="w-4 h-4" /> Créer un compte</button>
      </div>

      <div className="mt-8 bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-clay/50">
            <tr className="text-left text-xs uppercase tracking-widest">
                  <th className="p-3">Email</th><th className="p-3">Nom</th><th className="p-3">Badge</th><th className="p-3">Rôles</th><th className="p-3">POS</th><th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Chargement…</td></tr> :
              users.map((u: any) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.profile?.full_name ?? "—"}</td>
                  <td className="p-3">{u.profile?.badge_id ?? "—"}</td>
                  <td className="p-3">
                    {u.roles.map((r: string) => (
                      <span key={r} className="inline-block px-2 py-0.5 rounded bg-copper/15 text-copper text-xs mr-1">{r}</span>
                    ))}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{u.pos_account?.points_of_sale?.name ?? "—"}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => confirm("Supprimer ce compte ?") && deleteMut.mutate(u.id)}
                      className="text-destructive hover:bg-destructive/10 p-2 rounded"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-espresso/60 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-card rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-2xl">Créer un compte</h2>
            <p className="text-xs text-muted-foreground mt-1">L'utilisateur recevra ces identifiants pour se connecter.</p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <input placeholder="Nom complet" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="col-span-2 px-3 py-2 border border-border rounded bg-background" />
              <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-3 py-2 border border-border rounded bg-background" />
              <input placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 border border-border rounded bg-background" />
              <input placeholder="Badge (ex: LIV-001)" value={form.badge_id} onChange={(e) => setForm({ ...form, badge_id: e.target.value })} className="px-3 py-2 border border-border rounded bg-background" />
              <input placeholder="Mot de passe" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="px-3 py-2 border border-border rounded bg-background" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="col-span-2 px-3 py-2 border border-border rounded bg-background">
                <option value="admin">Administrateur</option>
                <option value="manager">Manager</option>
                <option value="livreur">Livreur</option>
                <option value="pos">Point de vente</option>
              </select>
            </div>
            {form.role === "pos" && (
              <div className="mt-4">
                <label className="text-xs uppercase tracking-widest mb-2 block">Point de vente associé</label>
                <select value={form.pos_id} onChange={(e) => setForm({ ...form, pos_id: e.target.value })} className="w-full px-3 py-2 border border-border rounded bg-background">
                  <option value="">Sélectionner un POS</option>
                  {posList.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}{p.city ? ` · ${p.city}` : ""}</option>
                  ))}
                </select>
              </div>
            )}
            {form.role === "manager" && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-widest mb-2">Permissions du manager</div>
                <div className="grid grid-cols-2 gap-2">
                  {permKeys.map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!form.permissions[k]}
                        onChange={(e) => setForm({ ...form, permissions: { ...form.permissions, [k]: e.target.checked } })} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 mt-6 justify-end">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn-hero" disabled={createMut.isPending} onClick={() => createMut.mutate(form)}>
                {createMut.isPending ? "Création…" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
