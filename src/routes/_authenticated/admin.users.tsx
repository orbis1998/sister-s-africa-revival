import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { StaffShell } from "@/components/admin/AdminLayout";
import { adminCreateUser, adminListUsers, adminDeleteUser, adminUpdateUser } from "@/lib/admin.functions";
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

const emptyForm = () => ({
  email: "", password: "", full_name: "", phone: "", badge_id: "",
  role: "livreur", city_scope: "kinshasa", permissions: {} as Record<string, boolean>, pos_id: "", pos_ids: [] as string[],
});

function PermissionsEditor({
  permissions,
  posIds,
  cityScope,
  onChangePermissions,
  onChangePosIds,
  posList,
}: {
  permissions: Record<string, boolean>;
  posIds: string[];
  cityScope: string;
  onChangePermissions: (next: Record<string, boolean>) => void;
  onChangePosIds: (next: string[]) => void;
  posList: any[];
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

function UserFormFields({
  form,
  setForm,
  posList,
  isEdit,
}: {
  form: any;
  setForm: (v: any) => void;
  posList: any[];
  isEdit?: boolean;
}) {
  return (
    <>
      <input placeholder="Nom complet" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="col-span-2 px-3 py-2 border border-border rounded bg-background" />
      <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-3 py-2 border border-border rounded bg-background" />
      <input placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 border border-border rounded bg-background" />
      <input placeholder="Badge (ex: LIV-001)" value={form.badge_id} onChange={(e) => setForm({ ...form, badge_id: e.target.value })} className="px-3 py-2 border border-border rounded bg-background" />
      <input
        placeholder={isEdit ? "Nouveau mot de passe (laisser vide = inchangé)" : "Mot de passe"}
        type="text"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        className="col-span-2 px-3 py-2 border border-border rounded bg-background"
      />
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
      {form.role === "livreur" && (
        <div className="col-span-2">
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
        <div className="col-span-2">
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
        <div className="col-span-2 mt-2">
          <div className="text-xs uppercase tracking-widest mb-2">Permissions du manager</div>
          <PermissionsEditor
            permissions={form.permissions}
            posIds={form.pos_ids}
            cityScope={form.city_scope}
            posList={posList}
            onChangePermissions={(permissions) => setForm({ ...form, permissions })}
            onChangePosIds={(pos_ids) => setForm({ ...form, pos_ids })}
          />
        </div>
      )}
    </>
  );
}

function UsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListUsers);
  const createFn = useServerFn(adminCreateUser);
  const updateFn = useServerFn(adminUpdateUser);
  const deleteFn = useServerFn(adminDeleteUser);
  const { data: users = [], isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => listFn({}) });
  const { data: posList = [] } = useQuery({
    queryKey: ["admin-pos-for-users"],
    queryFn: async () => (await supabase.from("points_of_sale").select("id,name,city,city_scope").order("name")).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [form, setForm] = useState<any>(emptyForm());

  const createMut = useMutation({
    mutationFn: (data: any) => createFn({ data: { ...data, pos_ids: data.pos_ids ?? [] } }),
    onSuccess: () => { toast.success("Compte créé"); setOpen(false); setForm(emptyForm()); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (data: any) => updateFn({ data }),
    onSuccess: () => {
      toast.success("Compte mis à jour");
      setEditUser(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (user_id: string) => deleteFn({ data: { user_id } }),
    onSuccess: () => { toast.success("Compte supprimé"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });

  function openEditUser(user: any) {
    const perms = user.manager_permissions ?? {};
    const initialPerms: Record<string, boolean> = {};
    for (const [key] of permKeys) initialPerms[key] = !!perms[key];
    const primaryRole = user.roles.find((r: string) => r !== "client") ?? user.roles[0] ?? "livreur";
    setEditUser({
      id: user.id,
      email: user.email ?? "",
      password: "",
      full_name: user.profile?.full_name ?? "",
      phone: user.profile?.phone ?? "",
      badge_id: user.profile?.badge_id ?? "",
      role: primaryRole,
      city_scope: user.profile?.city_scope ?? "kinshasa",
      permissions: initialPerms,
      pos_ids: (perms.pos_ids ?? []) as string[],
      pos_id: user.pos_account?.pos_id ?? user.profile?.pos_id ?? "",
    });
  }

  function validateUserForm(data: any, isEdit: boolean) {
    if (!data.full_name?.trim()) { toast.error("Nom complet requis"); return false; }
    if (!isEdit && !data.email?.trim()) { toast.error("Email requis"); return false; }
    if (!isEdit && !data.password?.trim()) { toast.error("Mot de passe requis"); return false; }
    if (data.role === "manager" && !(data.pos_ids as string[]).length) {
      toast.error("Sélectionnez au moins un point de vente pour ce manager");
      return false;
    }
    if (data.role === "livreur" && !data.pos_id) {
      toast.error("Sélectionnez un point de vente pour ce livreur");
      return false;
    }
    if (data.role === "pos" && !data.pos_id) {
      toast.error("Sélectionnez un point de vente pour ce compte POS");
      return false;
    }
    return true;
  }

  return (
    <StaffShell title="Administration" requiredRole="admin">
      <div className="flex justify-between items-end">
        <div>
          <span className="eyebrow">Équipe</span>
          <h1 className="font-display text-4xl mt-2">Utilisateurs</h1>
        </div>
        <button onClick={() => { setForm(emptyForm()); setOpen(true); }} className="btn-hero"><Plus className="w-4 h-4" /> Créer un compte</button>
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
                      <button
                        onClick={() => openEditUser(u)}
                        className="text-copper hover:bg-copper/10 p-2 rounded"
                        title="Modifier le compte"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
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
              <UserFormFields form={form} setForm={setForm} posList={posList} />
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn-hero" disabled={createMut.isPending} onClick={() => {
                if (!validateUserForm(form, false)) return;
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
            <h2 className="font-display text-2xl">Modifier le compte</h2>
            <p className="text-sm text-muted-foreground mt-1">{editUser.email}</p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <UserFormFields form={editUser} setForm={setEditUser} posList={posList} isEdit />
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <button className="btn-ghost" onClick={() => setEditUser(null)}>Annuler</button>
              <button
                className="btn-hero"
                disabled={updateMut.isPending}
                onClick={() => {
                  if (!validateUserForm(editUser, true)) return;
                  updateMut.mutate({
                    user_id: editUser.id,
                    email: editUser.email,
                    password: editUser.password || undefined,
                    full_name: editUser.full_name,
                    phone: editUser.phone,
                    badge_id: editUser.badge_id,
                    city_scope: editUser.city_scope,
                    role: editUser.role,
                    permissions: editUser.permissions,
                    pos_ids: editUser.pos_ids,
                    pos_id: editUser.pos_id || undefined,
                  });
                }}
              >
                {updateMut.isPending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
