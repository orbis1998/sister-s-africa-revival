import { Instagram, MessageCircle, MapPin, Phone } from "lucide-react";
import logo from "@/assets/logo.png";

export function Footer() {
  return (
    <footer className="bg-espresso text-cream mt-32">
      <div className="container-page py-20 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="md:col-span-1">
          <img src={logo} alt="The Sisters Africa" className="mb-5 h-16 w-auto object-contain" />
          <p className="text-sm text-cream/70 leading-relaxed">
            Powered by The Sisters — bouillies bio d'origine végétale pour une prise de poids saine
            et naturelle. Conçu en Afrique, livré dans toute l'Afrique.
          </p>
        </div>

        <div>
          <h4 className="eyebrow text-gold mb-5">Service client</h4>
          <ul className="space-y-3 text-sm text-cream/80">
            <li className="flex items-start gap-2"><Phone className="w-3.5 h-3.5 mt-1 shrink-0" /> Kinshasa : +243 994 186 790</li>
            <li className="flex items-start gap-2"><Phone className="w-3.5 h-3.5 mt-1 shrink-0" /> Katanga : +243 810 113 198</li>
            <li className="flex items-start gap-2"><Phone className="w-3.5 h-3.5 mt-1 shrink-0" /> Pointe-Noire : +242 06 531 3192</li>
            <li className="flex items-start gap-2"><Phone className="w-3.5 h-3.5 mt-1 shrink-0" /> Brazzaville : +242 05 671 9462</li>
          </ul>
        </div>

        <div>
          <h4 className="eyebrow text-gold mb-5">Points de vente</h4>
          <ul className="space-y-3 text-sm text-cream/80">
            <li className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 mt-1 shrink-0" /> Kintambo, Ave Luadi N°28 — Kinshasa</li>
            <li className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 mt-1 shrink-0" /> Golf Météo, ave Lac Kivu N°4 — Lubumbashi</li>
            <li className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 mt-1 shrink-0" /> Super U, Géant Casino — Brazzaville</li>
            <li className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 mt-1 shrink-0" /> Saja Market, Poto-Poto — Brazzaville</li>
          </ul>
        </div>
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
