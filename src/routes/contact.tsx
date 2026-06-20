import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, MapPin, Phone } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & points de vente — The Sisters Africa" },
      { name: "description", content: "Service client WhatsApp, points de vente à Kinshasa, Lubumbashi, Brazzaville et Pointe-Noire." },
    ],
  }),
  component: ContactPage,
});

const regions = [
  {
    label: "RDC — Kinshasa",
    whatsapp: "243994186790",
    phone: "+243 994 186 790",
    points: [
      "Kintambo · Ave Luadi N°28 (3ᵉ niveau, en face de l'ex pressing Papa Sola)",
      "GB Ouagadougou · En face de Mango",
      "Macampagne · Sur 24, Avenue de la Libération",
      "Lingwala · Huileries & Kalembelembe",
      "Bandalungwa · 136 Avenue Kisangani",
      "Kasavubu · 22 Avenue Victoire",
      "Makala · Université & Kikwit",
    ],
  },
  {
    label: "RDC — Katanga",
    whatsapp: "243810113198",
    phone: "+243 810 113 198",
    points: [
      "Lubumbashi · Kasavubu, coin Kimbangu",
      "Dépôt Golf Météo · Avenue Lac Kivu N°4",
      "Expéditions : Kolwezi, Likasi depuis Lubumbashi",
    ],
  },
  {
    label: "Congo — Brazzaville",
    whatsapp: "242056719462",
    phone: "+242 05 671 9462",
    points: [
      "Super U · Géant Casino, centre-ville Brazzaville",
      "Saja Market · Poto-Poto, Avenue de la Paix",
      "Mama Dina · Galerie Moka, Grand Marché",
      "Expéditions : Dakar, Abidjan, Paris, Libreville, Yaoundé & Douala",
    ],
  },
  {
    label: "Congo — Pointe-Noire",
    whatsapp: "242065313192",
    phone: "+242 06 531 3192",
    points: [
      "Pointe-Noire · Service client dédié",
      "Expéditions locales et accompagnement WhatsApp",
    ],
  },
];

function ContactPage() {
  return (
    <section className="container-page py-20">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <div className="eyebrow mb-3">Contact</div>
        <h1 className="font-display text-5xl md:text-6xl text-espresso mb-6">Parlons ensemble</h1>
        <p className="text-muted-foreground">
          Notre équipe vous répond par WhatsApp 7j/7. Trouvez aussi nos points de vente partenaires.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {regions.map((r) => (
          <article key={r.label} className="bg-card border border-border rounded-sm p-8">
            <div className="eyebrow mb-2">{r.label}</div>
            <a href={`https://wa.me/${r.whatsapp}`} target="_blank" rel="noreferrer" className="font-display text-xl text-espresso hover:text-copper flex items-center gap-2 mb-1">
              <Phone className="w-4 h-4" /> {r.phone}
            </a>
            <a href={`https://wa.me/${r.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs text-copper hover:underline mb-6">
              <MessageCircle className="w-3.5 h-3.5" /> Ouvrir WhatsApp
            </a>
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Points de vente</h3>
            <ul className="space-y-2">
              {r.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-espresso/80">
                  <MapPin className="w-3.5 h-3.5 mt-1 shrink-0 text-copper" /> {p}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
