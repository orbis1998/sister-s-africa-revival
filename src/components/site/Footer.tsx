import { Instagram, MessageCircle } from "lucide-react";
import logo from "@/assets/logo.png";

export function Footer() {
  return (
    <footer className="bg-espresso text-cream mt-32">
      <div className="container-page py-20">
        <img src={logo} alt="The Sisters Africa" className="mb-5 h-16 w-auto object-contain" />
        <p className="max-w-md text-sm text-cream/70 leading-relaxed">
          Powered by The Sisters — bouillies bio d'origine végétale pour une prise de poids saine
          et naturelle. Conçu en Afrique, livré dans toute l'Afrique.
        </p>
      </div>

      <div className="border-t border-cream/10">
        <div className="container-page py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-cream/50">
          <div>© {new Date().getFullYear()} The Sisters Africa — Tous droits réservés.</div>
          <div className="flex items-center gap-5">
            <a href="https://wa.me/243994186790" target="_blank" rel="noreferrer" className="hover:text-copper flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
            <a href="https://instagram.com/thesisters_africa" target="_blank" rel="noreferrer" className="hover:text-copper flex items-center gap-1.5">
              <Instagram className="w-3.5 h-3.5" /> @thesisters_africa
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
