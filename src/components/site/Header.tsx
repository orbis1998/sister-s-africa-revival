import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingBag, Menu, X, User } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useAuth, roleHome } from "@/lib/auth";
import logo from "@/assets/logo.png";

const nav = [
  { to: "/", label: "Accueil" },
  { to: "/products", label: "Produits" },
  { to: "/blog", label: "Blog" },
  { to: "/contact", label: "Contact" },
];

export function Header() {
  const { count } = useCart();
  const { user, roles } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const accountHref = user ? roleHome(roles) : "/auth";
  const accountLabel = user ? "Mon espace" : "Connexion";

  return (
    <header className="sticky top-0 z-50 bg-espresso/95 text-cream backdrop-blur-md border-b border-cream/10">
      <div className="container-page flex items-center justify-between h-18 md:h-20">
        <Link to="/" className="flex items-center" aria-label="The Sisters Africa">
          <img src={logo} alt="The Sisters Africa" className="h-12 w-auto object-contain md:h-14" />
        </Link>

        <nav className="hidden md:flex items-center gap-10">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`text-[11px] uppercase tracking-[0.22em] transition-colors ${
                pathname === n.to ? "text-gold" : "text-cream/70 hover:text-gold"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-4">
          <Link to={accountHref as any} className="hidden md:inline-flex p-2 text-cream/80 hover:text-gold transition-colors" aria-label="Compte">
            <User className="w-5 h-5" strokeWidth={1.5} />
          </Link>
          <Link
            to="/cart"
            className="relative p-2 text-cream/80 hover:text-gold transition-colors"
            aria-label="Panier"
          >
            <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-gold text-espresso text-[10px] font-medium w-4 h-4 rounded-full flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
          <button
            className="md:hidden p-2 text-cream/90"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-cream/10 bg-espresso">
          <div className="container-page py-6 flex flex-col gap-1">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-4 py-3 text-sm uppercase tracking-[0.22em] transition ${
                  pathname === n.to ? "bg-cream/10 text-gold" : "text-cream/80 hover:bg-cream/5"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <Link
              to={accountHref as any}
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-3 rounded-xl border border-cream/10 px-4 py-3 text-sm uppercase tracking-[0.22em] text-cream/90 hover:bg-cream/5"
            >
              <User className="w-4 h-4" strokeWidth={1.5} />
              {accountLabel}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
