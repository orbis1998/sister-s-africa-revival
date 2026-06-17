import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { StaffShell } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { adminUpsertPOS } from "@/lib/admin.functions";
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
  const [form, setForm] = useState<any>(null);
  const save = useMutation({
    mutationFn: (d: any) => upsert({ data: d }),
    onSuccess: () => { toast.success("Enregistré"); setForm(null); qc.invalidateQueries({ queryKey: ["admin-pos"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <StaffShell title="Administration" requiredRole="admin">
      <div className="flex justify-between items-end">
        <div>
          <span className="eyebrow">Distribution</span>
          <h1 className="font-display text-4xl mt-2">Points de vente</h1>
        </div>
        <button onClick={() => setForm({ name: "", city: "", address: "", phone: "" })} className="btn-hero">
          <Plus className="w-4 h-4" /> Nouveau POS
        </button>
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        {list.map((p: any) => (
          <button key={p.id} onClick={() => setForm(p)} className="text-left bg-card border border-border rounded-2xl p-5 hover:shadow-soft transition">
            <h3 className="font-display text-xl">{p.name}</h3>
            <p className="text-sm text-muted-foreground">{p.city}</p>
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
              <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded bg-background" />
              <input placeholder="Ville" value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full px-3 py-2 border border-border rounded bg-background" />
              <input placeholder="Adresse" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 border border-border rounded bg-background" />
              <input placeholder="Téléphone" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-border rounded bg-background" />
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <button className="btn-ghost" onClick={() => setForm(null)}>Annuler</button>
              <button className="btn-hero" disabled={save.isPending} onClick={() => save.mutate(form)}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
