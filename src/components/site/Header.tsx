import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";

const nav = [
  { to: "/", label: "Accueil" },
  { to: "/products", label: "Boutique" },
  { to: "/contact", label: "Contact" },
];

export function Header() {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-50 bg-cream/85 backdrop-blur-md border-b border-border/60">
      <div className="container-page flex items-center justify-between h-20">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-display text-3xl tracking-tight text-espresso leading-none">
            <span className="text-copper">The</span>sisters
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-10">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`text-[11px] uppercase tracking-[0.22em] transition-colors ${
                pathname === n.to ? "text-copper" : "text-espresso/70 hover:text-copper"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            to="/cart"
            className="relative p-2 text-espresso hover:text-copper transition-colors"
            aria-label="Panier"
          >
            <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-copper text-primary-foreground text-[10px] font-medium w-4 h-4 rounded-full flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
          <button
            className="md:hidden p-2 text-espresso"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/60 bg-cream">
          <div className="container-page py-6 flex flex-col gap-4">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="text-sm uppercase tracking-[0.22em] text-espresso/80"
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
