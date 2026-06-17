import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { StaffShell } from "@/components/admin/AdminLayout";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/livreur")({
  component: LivreurDashboard,
});

function LivreurDashboard() {
  const { user } = useAuth();
  return (
    <StaffShell title="Livreur" requiredRole="livreur">
      <span className="eyebrow">Espace livreur</span>
      <h1 className="font-display text-4xl mt-2">Mes livraisons</h1>
      <p className="text-muted-foreground mt-2">Connecté en tant que {user?.email}</p>
      <div className="mt-8 bg-card border border-border rounded-2xl p-10 text-center">
        <Truck className="w-10 h-10 text-copper mx-auto" strokeWidth={1.5} />
        <h2 className="font-display text-2xl mt-4">Aucune course assignée</h2>
        <p className="text-sm text-muted-foreground mt-2">Les courses du jour apparaîtront ici dès qu'elles seront attribuées par l'administration.</p>
      </div>
    </StaffShell>
  );
}
