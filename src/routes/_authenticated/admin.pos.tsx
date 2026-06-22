import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { StaffShell } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { adminUpsertPOS } from "@/lib/admin.functions";
import { STAFF_DIRECTIONS, directionLabel } from "@/lib/staff-scope";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/pos")({
  component: POSPage,
});

function POSPage() {
  const qc = useQueryClient();
  const upsert = useServerFn(adminUpsertPOS);
  const { data: list = [] } = useQuery({
    queryKey: ["admin-pos"], queryFn: async () => (await supabase.from("points_of_sale").select("*").order("name")).data ?? [],
  });
  const { data: managers = [] } = useQuery({
    queryKey: ["admin-pos-managers"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "manager");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, city_scope").in("id", ids);
      return profiles ?? [];
    },
  });
  const [form, setForm] = useState<any>(null);
  const save = useMutation({
    mutationFn: (d: any) => upsert({ data: d }),
    onSuccess: () => {
      toast.success("Enregistré");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["admin-pos"] });
      qc.invalidateQueries({ queryKey: ["admin-pos-managers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <StaffShell title="Administration" requiredRole="admin">
      <div className="flex justify-between items-end">
        <div>
          <span className="eyebrow">Distribution</span>
          <h1 className="font-display text-4xl mt-2">Points de vente</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Chaque POS est rattaché à une direction et à un manager responsable. Le stock et les commandes web de cette ville impactent ce POS.
          </p>
        </div>
        <button onClick={() => setForm({ name: "", city: "", city_scope: "kinshasa", address: "", phone: "", manager_user_id: "" })} className="btn-hero">
          <Plus className="w-4 h-4" /> Nouveau POS
        </button>
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        {list.map((p: any) => (
          <button key={p.id} onClick={() => setForm({ ...p, manager_user_id: p.manager_user_id ?? "" })} className="text-left bg-card border border-border rounded-2xl p-5 hover:shadow-soft transition">
            <h3 className="font-display text-xl">{p.name}</h3>
            <p className="text-sm text-muted-foreground">{directionLabel(p.city_scope)}{p.city ? ` · ${p.city}` : ""}</p>
            <p className="text-xs text-muted-foreground mt-1">{p.address}</p>
            <p className="text-xs mt-1">{p.phone}</p>
          </button>
        ))}
        {list.length === 0 && <p className="text-muted-foreground">Aucun POS. Créez-en un pour commencer.</p>}
      </div>

      {form && (
        <div className="fixed inset-0 bg-espresso/60 z-50 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-card rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-2xl">{form.id ? "Modifier" : "Nouveau POS"}</h2>
            <div className="space-y-3 mt-4">
              <input placeholder="Nom du POS" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-admin" />
              <select value={form.city_scope ?? ""} onChange={(e) => setForm({ ...form, city_scope: e.target.value })} className="input-admin">
                {STAFF_DIRECTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label} ({d.currency})</option>
                ))}
              </select>
              <input placeholder="Ville (affichage)" value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-admin" />
              <input placeholder="Adresse" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-admin" />
              <input placeholder="Téléphone" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-admin" />
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">Manager responsable</label>
                <select value={form.manager_user_id ?? ""} onChange={(e) => setForm({ ...form, manager_user_id: e.target.value })} className="input-admin">
                  <option value="">— Aucun —</option>
                  {managers.filter((m: any) => !form.city_scope || m.city_scope === form.city_scope || !m.city_scope).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.full_name ?? m.id}{m.city_scope ? ` · ${directionLabel(m.city_scope)}` : ""}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <button className="btn-ghost" onClick={() => setForm(null)}>Annuler</button>
              <button className="btn-hero" disabled={save.isPending || !form.name.trim() || !form.city_scope} onClick={() => save.mutate({
                ...form,
                manager_user_id: form.manager_user_id || null,
              })}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
