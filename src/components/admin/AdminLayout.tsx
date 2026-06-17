import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Package, Boxes, Store, LogOut, Truck, Briefcase } from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth";
import { useEffect, type ReactNode } from "react";

type NavLink = { to: string; label: string; icon: any; exact?: boolean };

const adminLinks: NavLink[] = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Utilisateurs", icon: Users },
  { to: "/admin/products", label: "Produits", icon: Package },
  { to: "/admin/stock", label: "Stock", icon: Boxes },
  { to: "/admin/pos", label: "Points de vente", icon: Store },
];

export function StaffShell({
  children, title, requiredRole,
}: { children: ReactNode; title: string; requiredRole: AppRole }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { roles, loading, signOut, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !roles.includes(requiredRole)) {
      navigate({ to: "/auth" });
    }
  }, [loading, roles, user, requiredRole, navigate]);

  const links: NavLink[] = requiredRole === "admin" ? adminLinks
    : requiredRole === "manager" ? [{ to: "/manager", label: "Manager", icon: Briefcase, exact: true }]
    : [{ to: "/livreur", label: "Livreur", icon: Truck, exact: true }];

  return (
    <div className="min-h-screen flex bg-cream">
      <aside className="w-64 bg-espresso text-cream flex flex-col">
        <div className="p-6 border-b border-cream/10">
          <div className="font-display text-2xl">The<span className="text-copper">sisters</span></div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-cream/60 mt-1">{title}</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {links.map((l) => {
            const active = l.exact ? pathname === l.to : pathname.startsWith(l.to);
            return (
              <Link key={l.to} to={l.to as any} className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition ${
                active ? "bg-copper text-cream" : "text-cream/80 hover:bg-cream/5"
              }`}>
                <l.icon className="w-4 h-4" strokeWidth={1.5} /> {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-cream/10">
          <div className="text-xs text-cream/60 px-3 mb-2 truncate">{user?.email}</div>
          <button onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded text-sm text-cream/80 hover:bg-cream/5">
            <LogOut className="w-4 h-4" /> Déconnexion
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
