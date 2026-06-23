import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StaffShell } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { adminUpsertPOS, adminListPosSales, adminListPosManagers } from "@/lib/admin.functions";
import { STAFF_DIRECTIONS, directionLabel, formatScopedMoney } from "@/lib/staff-scope";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/pos")({
  component: POSPage,
});

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  mobile_money: "Mobile Money",
  card: "Carte",
};

function formatItemLine(item: any, cityScope?: string | null) {
  const total = formatScopedMoney(
    { total_usd: Number(item.price_usd ?? 0) * Number(item.qty ?? 1), total_fcfa: Number(item.price_fcfa ?? 0) * Number(item.qty ?? 1) },
    cityScope,
  );
  return `${item.qty} × ${item.name}${item.variant_label ? ` (${item.variant_label})` : ""} — ${total}`;
}

function POSPage() {
  const qc = useQueryClient();
  const upsert = useServerFn(adminUpsertPOS);
  const listSalesFn = useServerFn(adminListPosSales);
  const listManagersFn = useServerFn(adminListPosManagers);
  const { data: list = [] } = useQuery({
    queryKey: ["admin-pos"], queryFn: async () => (await supabase.from("points_of_sale").select("*").order("name")).data ?? [],
  });
  const [form, setForm] = useState<any>(null);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  const { data: eligibleManagers = [], refetch: refetchManagers } = useQuery({
    queryKey: ["admin-pos-eligible-managers", form?.id, form?.city_scope],
    enabled: !!form,
    queryFn: () => listManagersFn({ data: { pos_id: form?.id, city_scope: form?.city_scope } }),
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["admin-pos-sales", form?.id],
    enabled: !!form?.id,
    queryFn: () => listSalesFn({ data: { pos_id: form!.id, limit: 100 } }),
  });

  useEffect(() => {
    if (!form || form._managersLoaded) return;
    if (!eligibleManagers.length && form.id) return;
    const assigned = eligibleManagers.filter((m: any) => m.assigned).map((m: any) => m.id);
    setForm((prev: any) => prev ? { ...prev, manager_user_ids: assigned, _managersLoaded: true } : prev);
  }, [form, eligibleManagers]);

  const save = useMutation({
    mutationFn: (d: any) => upsert({ data: d }),
    onSuccess: () => {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["admin-pos"] });
      qc.invalidateQueries({ queryKey: ["admin-pos-eligible-managers"] });
      qc.invalidateQueries({ queryKey: ["admin-pos-card-managers"] });
      refetchManagers();
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openForm(pos?: any) {
    setExpandedSaleId(null);
    if (!pos) {
      setForm({ name: "", city: "", city_scope: "kinshasa", address: "", phone: "", manager_user_ids: [], _managersLoaded: true });
      return;
    }
    setForm({ ...pos, manager_user_ids: [], _managersLoaded: false });
  }

  return (
    <StaffShell title="Administration" requiredRole="admin">
      <div className="flex justify-between items-end">
        <div>
          <span className="eyebrow">Distribution</span>
          <h1 className="font-display text-4xl mt-2">Points de vente</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Associez plusieurs managers POS de la même direction — ils partagent le stock et peuvent vendre en présentiel sur ce point de vente.
          </p>
        </div>
        <button onClick={() => openForm()} className="btn-hero">
          <Plus className="w-4 h-4" /> Nouveau POS
        </button>
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        {list.map((p: any) => (
          <PosCard key={p.id} pos={p} onOpen={() => openForm(p)} listManagersFn={listManagersFn} />
        ))}
        {list.length === 0 && <p className="text-muted-foreground">Aucun POS. Créez-en un pour commencer.</p>}
      </div>

      {form && (
        <div className="fixed inset-0 bg-espresso/60 z-50 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-card rounded-2xl max-w-3xl w-full p-6 max-h-[92vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-2xl">{form.id ? form.name : "Nouveau POS"}</h2>
            <p className="text-xs text-muted-foreground mt-1">{form.id ? "Paramètres, managers et historique des ventes" : "Création d'un point de vente"}</p>

            <div className="space-y-3 mt-4">
              <input placeholder="Nom du POS" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-admin" />
              <select
                value={form.city_scope ?? ""}
                onChange={(e) => setForm({ ...form, city_scope: e.target.value, manager_user_ids: [], _managersLoaded: true })}
                className="input-admin"
              >
                {STAFF_DIRECTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label} ({d.currency})</option>
                ))}
              </select>
              <input placeholder="Ville (affichage)" value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-admin" />
              <input placeholder="Adresse" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-admin" />
              <input placeholder="Téléphone" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-admin" />
              <div className="rounded-xl border border-border bg-cream/40 p-4">
                <label className="mb-2 block text-[10px] uppercase tracking-widest text-muted-foreground">
                  Managers responsables (permission POS · même direction)
                </label>
                {eligibleManagers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun manager éligible. Activez la permission POS et la direction depuis Utilisateurs.
                  </p>
                ) : (
                  <div className="grid gap-2 max-h-48 overflow-auto">
                    {eligibleManagers.map((m: any) => (
                      <label key={m.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(form.manager_user_ids ?? []).includes(m.id)}
                          onChange={(e) => {
                            const current = new Set(form.manager_user_ids ?? []);
                            if (e.target.checked) current.add(m.id);
                            else current.delete(m.id);
                            setForm({ ...form, manager_user_ids: [...current] });
                          }}
                        />
                        <span>{m.full_name ?? m.id}{m.badge_id ? ` · ${m.badge_id}` : ""}</span>
                        <span className="text-xs text-muted-foreground">{directionLabel(m.city_scope)}</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Tous les managers cochés partagent le même stock POS et peuvent enregistrer des ventes en présentiel.
                </p>
              </div>
            </div>

            {form.id && (
              <div className="mt-8 border-t border-border pt-6">
                <h3 className="font-display text-xl">Ventes POS</h3>
                <p className="mt-1 text-xs text-muted-foreground">Détail des ventes enregistrées à ce point de vente.</p>
                {salesLoading ? (
                  <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>
                ) : sales.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">Aucune vente enregistrée.</p>
                ) : (
                  <div className="mt-4 space-y-2 max-h-[340px] overflow-auto">
                    {sales.map((sale: any) => {
                      const open = expandedSaleId === sale.id;
                      const items = (sale.items ?? []) as any[];
                      return (
                        <div key={sale.id} className="rounded-xl border border-border bg-cream/50 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedSaleId(open ? null : sale.id)}
                            className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-cream/80"
                          >
                            <div>
                              <div className="font-medium text-espresso">
                                {new Date(sale.created_at).toLocaleString("fr-FR")}
                                {" · "}
                                {sale.customer_name?.trim() || "Client comptoir"}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Vendeur : {sale.seller?.full_name ?? "—"}
                                {sale.seller?.badge_id ? ` (${sale.seller.badge_id})` : ""}
                                {" · "}
                                {PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-medium text-copper">
                                {formatScopedMoney({ total_usd: sale.total_usd, total_fcfa: sale.total_fcfa }, form.city_scope)}
                              </span>
                              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </button>
                          {open && (
                            <div className="border-t border-border bg-card px-3 py-3 text-sm">
                              {sale.customer_phone && (
                                <div className="text-xs text-muted-foreground mb-2">Tél. client : {sale.customer_phone}</div>
                              )}
                              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Produits</div>
                              <ul className="space-y-1.5">
                                {items.length === 0 ? (
                                  <li className="text-muted-foreground">Aucun détail produit</li>
                                ) : items.map((item, idx) => (
                                  <li key={idx} className="rounded-lg bg-cream/70 px-3 py-2">
                                    {formatItemLine(item, form.city_scope)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-6 justify-end">
              <button className="btn-ghost" onClick={() => setForm(null)}>Fermer</button>
              <button
                className="btn-hero"
                disabled={save.isPending || !form.name.trim() || !form.city_scope}
                onClick={() => save.mutate({
                  id: form.id,
                  name: form.name,
                  city: form.city,
                  city_scope: form.city_scope,
                  address: form.address,
                  phone: form.phone,
                  manager_user_ids: form.manager_user_ids ?? [],
                })}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}

function PosCard({
  pos,
  onOpen,
  listManagersFn,
}: {
  pos: any;
  onOpen: () => void;
  listManagersFn: ReturnType<typeof useServerFn<typeof adminListPosManagers>>;
}) {
  const { data: managers = [] } = useQuery({
    queryKey: ["admin-pos-card-managers", pos.id],
    queryFn: () => listManagersFn({ data: { pos_id: pos.id, city_scope: pos.city_scope } }),
  });
  const assigned = managers.filter((m: any) => m.assigned);

  return (
    <button onClick={onOpen} className="text-left bg-card border border-border rounded-2xl p-5 hover:shadow-soft transition">
      <h3 className="font-display text-xl">{pos.name}</h3>
      <p className="text-sm text-muted-foreground">{directionLabel(pos.city_scope)}{pos.city ? ` · ${pos.city}` : ""}</p>
      <p className="text-xs text-muted-foreground mt-1">{pos.address}</p>
      <p className="text-xs mt-1">{pos.phone}</p>
      {assigned.length > 0 && (
        <p className="mt-3 text-xs text-copper">
          Managers : {assigned.map((m: any) => m.full_name).filter(Boolean).join(", ")}
        </p>
      )}
    </button>
  );
}
