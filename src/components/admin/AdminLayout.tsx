import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Package, Boxes, Store, LogOut, Truck, Briefcase, ClipboardList, Star, Settings, ShoppingCart, HandCoins, BookOpen, Wallet, MapPin, Plane } from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyManagerPermissions, normalizeManagerPermissions, type ManagerPermissions } from "@/lib/permissions.functions";
import logo from "@/assets/logo.png";

type PermissionKey =
  | "can_manage_products"
  | "can_manage_stock"
  | "can_manage_orders"
  | "can_manage_logistics"
  | "can_view_accounting"
  | "can_record_wholesale"
  | "can_record_expenses"
  | "can_manage_pos"
  | "can_manage_users";
type NavLink = { to: string; label: string; icon: any; exact?: boolean; permissions?: PermissionKey[]; requireAll?: boolean };

function effectiveManagerPerms(perms: ManagerPermissions | null | undefined) {
  if (!perms) return null;
  return { ...perms, ...normalizeManagerPermissions(perms) };
}

function managerLinkVisible(perms: ManagerPermissions | null | undefined, link: NavLink) {
  const effective = effectiveManagerPerms(perms);
  if (!link.permissions?.length) return true;
  if (!effective) return false;
  return link.requireAll
    ? link.permissions.every((permission) => effective[permission] === true)
    : link.permissions.some((permission) => effective[permission] === true);
}

function managerHasPermission(perms: ManagerPermissions | null | undefined, required: PermissionKey[], requireAll = false) {
  const effective = effectiveManagerPerms(perms);
  if (!required.length) return true;
  if (!effective) return false;
  return requireAll
    ? required.every((permission) => effective[permission] === true)
    : required.some((permission) => effective[permission] === true);
}

const adminLinks: NavLink[] = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Utilisateurs", icon: Users },
  { to: "/admin/products", label: "Produits", icon: Package },
  { to: "/admin/stock", label: "Stock", icon: Boxes },
  { to: "/admin/logistics", label: "Logistique", icon: ClipboardList },
  { to: "/admin/wholesale", label: "Vente en gros", icon: HandCoins },
  { to: "/admin/reviews", label: "Avis clients", icon: Star },
  { to: "/admin/blog", label: "Points de vente", icon: BookOpen },
  { to: "/admin/expedition-page", label: "Expédition", icon: Plane },
  { to: "/admin/contact-page", label: "Contact", icon: MapPin },
  { to: "/admin/pos", label: "Magasins POS", icon: Store },
  { to: "/admin/settings", label: "Paramètres", icon: Settings },
];

export function StaffShell({
  children, title, requiredRole, requiredPermission, requireAllPermissions,
}: {
  children: ReactNode;
  title: string;
  requiredRole: AppRole | AppRole[];
  requiredPermission?: PermissionKey | PermissionKey[];
  requireAllPermissions?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { roles, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const primaryRole = roles.includes("admin") && allowedRoles.includes("admin")
    ? "admin"
    : allowedRoles.find((role) => roles.includes(role)) ?? allowedRoles[0];
  const fetchManagerPerms = useServerFn(getMyManagerPermissions);
  const requiredPermissions = requiredPermission ? (Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission]) : [];
  const managerPerms = useQuery({
    queryKey: ["manager-permissions", user?.id],
    enabled: !!user && roles.includes("manager") && !roles.includes("admin"),
    queryFn: () => fetchManagerPerms({}),
    staleTime: 30_000,
  });
  const hasRequiredPermission =
    !requiredPermissions.length ||
    roles.includes("admin") ||
    !roles.includes("manager") ||
    managerHasPermission(managerPerms.data, requiredPermissions, !!requireAllPermissions);

  useEffect(() => {
    if (!loading && user && !allowedRoles.some((role) => roles.includes(role))) {
      navigate({ to: "/auth" });
      return;
    }
    if (
      !loading &&
      user &&
      roles.includes("manager") &&
      !roles.includes("admin") &&
      requiredPermissions.length &&
      managerPerms.isSuccess &&
      !hasRequiredPermission
    ) {
      navigate({ to: "/manager" });
    }
  }, [loading, roles, user, allowedRoles, requiredPermissions, managerPerms.isSuccess, hasRequiredPermission, navigate]);

  const links: NavLink[] = primaryRole === "admin" ? adminLinks
    : primaryRole === "manager" ? [
      { to: "/manager", label: "Manager", icon: Briefcase, exact: true },
      { to: "/manager/accounting", label: "Comptabilité", icon: Wallet, permissions: ["can_view_accounting"], exact: true },
      { to: "/pos", label: "POS", icon: ShoppingCart, permissions: ["can_manage_pos"] },
      { to: "/admin/products", label: "Produits", icon: Package, permissions: ["can_manage_products"] },
      { to: "/admin/stock", label: "Stock", icon: Boxes, permissions: ["can_manage_stock"] },
      { to: "/admin/logistics", label: "Commandes", icon: ClipboardList, permissions: ["can_manage_orders", "can_manage_logistics"] },
      { to: "/admin/wholesale", label: "Vente en gros", icon: HandCoins, permissions: ["can_record_wholesale"] },
    ]
    : primaryRole === "pos" ? [{ to: "/pos", label: "POS", icon: ShoppingCart, exact: true }]
    : [{ to: "/livreur", label: "Livreur", icon: Truck, exact: true }];
  const visibleLinks = primaryRole === "manager"
    ? links.filter((link) => roles.includes("admin") || managerLinkVisible(managerPerms.data, link))
    : links;

  return (
    <div className="min-h-screen bg-cream lg:flex">
      <aside className="bg-espresso text-cream lg:flex lg:w-64 lg:flex-col">
        <div className="p-5 border-b border-cream/10">
          <img src={logo} alt="The Sisters Africa" className="h-12 w-auto object-contain" />
          <div className="text-[10px] uppercase tracking-[0.25em] text-cream/60 mt-1">{title}</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-3 lg:flex-1 lg:flex-col lg:space-y-1 lg:overflow-visible">
          {visibleLinks.map((l) => {
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
