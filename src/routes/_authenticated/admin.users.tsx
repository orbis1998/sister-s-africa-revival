import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { StaffShell } from "@/components/admin/AdminLayout";
import { adminCreateUser, adminListUsers, adminDeleteUser } from "@/lib/admin.functions";
import { adminUpdateManagerPermissions } from "@/lib/permissions.functions";
import { directionLabel, STAFF_DIRECTIONS } from "@/lib/staff-scope";
import { Trash2, Plus, Pencil } from "lucide-react";
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
  ["can_record_expenses", "Dépenses"],
  ["can_record_wholesale", "Vente en gros"],
  ["can_manage_pos", "POS"],
  ["can_manage_users", "Utilisateurs"],
] as const;

function UsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListUsers);
  const createFn = useServerFn(adminCreateUser);
  const deleteFn = useServerFn(adminDeleteUser);
  const updatePermsFn = useServerFn(adminUpdateManagerPermissions);
  const { data: users = [], isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => listFn({}) });
  const { data: posList = [] } = useQuery({
    queryKey: ["admin-pos-for-users"],
    queryFn: async () => (await supabase.from("points_of_sale").select("id,name,city,city_scope").order("name")).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [form, setForm] = useState<any>({
    email: "", password: "", full_name: "", phone: "", badge_id: "",
    role: "livreur", city_scope: "kinshasa", permissions: {}, pos_id: "", pos_ids: [] as string[],
  });

  const createMut = useMutation({
    mutationFn: (data: any) => createFn({ data: { ...data, pos_ids: data.pos_ids ?? [] } }),
    onSuccess: () => { toast.success("Compte créé"); setOpen(false); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (user_id: string) => deleteFn({ data: { user_id } }),
    onSuccess: () => { toast.success("Compte supprimé"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });
  const updatePermsMut = useMutation({
    mutationFn: (payload: { user_id: string; permissions: Record<string, boolean>; pos_ids: string[] }) =>
      updatePermsFn({ data: payload }),
    onSuccess: () => {
      toast.success("Permissions mises à jour");
      setEditUser(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEditPermissions(user: any) {
    const perms = user.manager_permissions ?? {};
    const initial: Record<string, boolean> = {};
    for (const [key] of permKeys) initial[key] = !!perms[key];
    setEditUser({
      id: user.id,
      email: user.email,
      full_name: user.profile?.full_name ?? "",
      city_scope: user.profile?.city_scope ?? "kinshasa",
      permissions: initial,
      pos_ids: (perms.pos_ids ?? []) as string[],
    });
  }

  function PermissionsEditor({
    permissions,
    posIds,
    cityScope,
    onChangePermissions,
    onChangePosIds,
  }: {
    permissions: Record<string, boolean>;
    posIds: string[];
    cityScope: string;
    onChangePermissions: (next: Record<string, boolean>) => void;
    onChangePosIds: (next: string[]) => void;
  }) {
    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          {permKeys.map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!permissions[k]}
                onChange={(e) => onChangePermissions({ ...permissions, [k]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-border bg-cream/40 p-4">
          <div className="text-xs uppercase tracking-widest mb-2">Points de vente associés (obligatoire)</div>
          <div className="grid gap-2">
            {posList.filter((p: any) => !cityScope || p.city_scope === cityScope || !p.city_scope).map((p: any) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={posIds.includes(p.id)}
                  onChange={(e) => {
                    const current = new Set(posIds);
                    if (e.target.checked) current.add(p.id);
                    else current.delete(p.id);
                    onChangePosIds([...current]);
                  }}
                />
                {p.name}{p.city ? ` · ${p.city}` : ""}
              </label>
            ))}
          </div>
        </div>
      </>
    );
  }

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
                  <th className="p-3">Email</th><th className="p-3">Nom</th><th className="p-3">Badge</th><th className="p-3">Direction</th><th className="p-3">Rôles</th><th className="p-3">POS</th><th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Chargement…</td></tr> :
              users.map((u: any) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.profile?.full_name ?? "—"}</td>
                  <td className="p-3">{u.profile?.badge_id ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{directionLabel(u.profile?.city_scope)}</td>
                  <td className="p-3">
                    {u.roles.map((r: string) => (
                      <span key={r} className="inline-block px-2 py-0.5 rounded bg-copper/15 text-copper text-xs mr-1">{r}</span>
                    ))}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{u.pos_account?.points_of_sale?.name ?? "—"}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      {u.roles.includes("manager") && (
                        <button
                          onClick={() => openEditPermissions(u)}
                          className="text-copper hover:bg-copper/10 p-2 rounded"
                          title="Modifier les permissions"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => confirm("Supprimer ce compte ?") && deleteMut.mutate(u.id)}
                        className="text-destructive hover:bg-destructive/10 p-2 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
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
              {form.role !== "admin" && (
                <select value={form.city_scope} onChange={(e) => setForm({ ...form, city_scope: e.target.value })} className="col-span-2 px-3 py-2 border border-border rounded bg-background">
                  {STAFF_DIRECTIONS.map((direction) => (
                    <option key={direction.value} value={direction.value}>{direction.label}</option>
                  ))}
                </select>
              )}
            </div>
            {form.role === "livreur" && (
              <div className="mt-4">
                <label className="text-xs uppercase tracking-widest mb-2 block">Point de vente associé (obligatoire)</label>
                <select value={form.pos_id} onChange={(e) => setForm({ ...form, pos_id: e.target.value })} className="w-full px-3 py-2 border border-border rounded bg-background">
                  <option value="">Sélectionner un POS</option>
                  {posList.filter((p: any) => !form.city_scope || p.city_scope === form.city_scope).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}{p.city ? ` · ${p.city}` : ""}</option>
                  ))}
                </select>
              </div>
            )}
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
                <PermissionsEditor
                  permissions={form.permissions}
                  posIds={form.pos_ids}
                  cityScope={form.city_scope}
                  onChangePermissions={(permissions) => setForm({ ...form, permissions })}
                  onChangePosIds={(pos_ids) => setForm({ ...form, pos_ids })}
                />
              </div>
            )}
            <div className="flex gap-2 mt-6 justify-end">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn-hero" disabled={createMut.isPending} onClick={() => {
                if (form.role === "manager" && !(form.pos_ids as string[]).length) {
                  toast.error("Sélectionnez au moins un point de vente pour ce manager");
                  return;
                }
                if (form.role === "livreur" && !form.pos_id) {
                  toast.error("Sélectionnez un point de vente pour ce livreur");
                  return;
                }
                createMut.mutate(form);
              }}>
                {createMut.isPending ? "Création…" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 bg-espresso/60 z-50 flex items-center justify-center p-4" onClick={() => setEditUser(null)}>
          <div className="bg-card rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-2xl">Permissions manager</h2>
            <p className="text-sm text-muted-foreground mt-1">{editUser.full_name || editUser.email}</p>
            <div className="mt-4">
              <PermissionsEditor
                permissions={editUser.permissions}
                posIds={editUser.pos_ids}
                cityScope={editUser.city_scope}
                onChangePermissions={(permissions) => setEditUser({ ...editUser, permissions })}
                onChangePosIds={(pos_ids) => setEditUser({ ...editUser, pos_ids })}
              />
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <button className="btn-ghost" onClick={() => setEditUser(null)}>Annuler</button>
              <button
                className="btn-hero"
                disabled={updatePermsMut.isPending}
                onClick={() => {
                  if (!editUser.pos_ids.length) {
                    toast.error("Sélectionnez au moins un point de vente");
                    return;
                  }
                  updatePermsMut.mutate({
                    user_id: editUser.id,
                    permissions: editUser.permissions,
                    pos_ids: editUser.pos_ids,
                  });
                }}
              >
                {updatePermsMut.isPending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
