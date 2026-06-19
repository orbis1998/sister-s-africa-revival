import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Package, Boxes, Store, LogOut, Truck, Briefcase, ClipboardList, Star, Settings, ShoppingCart } from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth";
import { useEffect, type ReactNode } from "react";
import logo from "@/assets/logo.png";

type NavLink = { to: string; label: string; icon: any; exact?: boolean };

const adminLinks: NavLink[] = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Utilisateurs", icon: Users },
  { to: "/admin/products", label: "Produits", icon: Package },
  { to: "/admin/stock", label: "Stock", icon: Boxes },
  { to: "/admin/logistics", label: "Logistique", icon: ClipboardList },
  { to: "/admin/reviews", label: "Avis clients", icon: Star },
  { to: "/admin/pos", label: "Points de vente", icon: Store },
  { to: "/admin/settings", label: "Paramètres", icon: Settings },
];

export function StaffShell({
  children, title, requiredRole,
}: { children: ReactNode; title: string; requiredRole: AppRole | AppRole[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { roles, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const primaryRole = roles.includes("admin") && allowedRoles.includes("admin") ? "admin" : allowedRoles[0];

  useEffect(() => {
    if (!loading && user && !allowedRoles.some((role) => roles.includes(role))) {
      navigate({ to: "/auth" });
    }
  }, [loading, roles, user, allowedRoles, navigate]);

  const links: NavLink[] = primaryRole === "admin" ? adminLinks
    : primaryRole === "manager" ? [
      { to: "/manager", label: "Manager", icon: Briefcase, exact: true },
      { to: "/admin/logistics", label: "Commandes", icon: ClipboardList },
    ]
    : primaryRole === "pos" ? [{ to: "/pos", label: "POS", icon: ShoppingCart, exact: true }]
    : [{ to: "/livreur", label: "Livreur", icon: Truck, exact: true }];

  return (
    <div className="min-h-screen bg-cream lg:flex">
      <aside className="bg-espresso text-cream lg:flex lg:w-64 lg:flex-col">
        <div className="p-5 border-b border-cream/10">
          <img src={logo} alt="The Sisters Africa" className="h-12 w-auto object-contain" />
          <div className="text-[10px] uppercase tracking-[0.25em] text-cream/60 mt-1">{title}</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-3 lg:flex-1 lg:flex-col lg:space-y-1 lg:overflow-visible">
          {links.map((l) => {
            const active = l.exact ? pathname === l.to : pathname.startsWith(l.to);
            return (
              <Link key={l.to} to={l.to as any} className={`flex shrink-0 items-center gap-3 px-3 py-2.5 rounded text-sm transition ${
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
        <div className="max-w-6xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
