import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Leaf, Sparkles } from "lucide-react";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog — The Sisters Africa" },
      {
        name: "description",
        content:
          "Guides, conseils et informations utiles pour comprendre les bouillies bio The Sisters Africa, la prise de poids saine et l'accompagnement client.",
      },
    ],
  }),
  component: BlogPage,
});

const articles = [
  {
    number: "01",
    title: "Mass Gainer pour adultes",
    category: "Produit adulte",
    readTime: "4 min",
    excerpt:
      "Mass Gainer est une bouillie de protéines bio d'origine végétale destinée aux hommes et femmes à partir de 14 ans.",
    body:
      "Elle est spécialement conçue pour favoriser une prise de poids saine avec une consommation régulière. La marque met en avant des résultats visibles en deux semaines selon la régularité, l'alimentation et le métabolisme de chaque personne.",
  },
  {
    number: "02",
    title: "Bénéfices du Mass Gainer",
    category: "Bénéfices",
    readTime: "3 min",
    excerpt:
      "La formule vise une prise de poids générale et peut aussi accompagner le développement des formes selon la génétique.",
    body:
      "D'après les informations de la marque, de nombreuses femmes observent un développement au niveau des hanches, des joues ou de la poitrine. Ces effets ne sont pas identiques pour toutes : ils dépendent du corps, de la génétique et de la constance.",
  },
  {
    number: "03",
    title: "Sport ou sans sport ?",
    category: "Routine",
    readTime: "4 min",
    excerpt:
      "La bouillie peut s'intégrer avec ou sans activité sportive, mais le sport aide à obtenir un résultat plus défini.",
    body:
      "La marque indique que les résultats sont possibles avec ou sans sport. Cependant, une routine sportive permet de mieux structurer la prise de poids et d'obtenir une silhouette plus tonique.",
  },
  {
    number: "04",
    title: "Comment la formule agit",
    category: "Nutrition",
    readTime: "4 min",
    excerpt:
      "La bouillie est présentée comme un soutien pour stimuler l'appétit, renforcer les os et ralentir le métabolisme.",
    body:
      "L'objectif est d'aider le corps à mieux transformer ce qui est consommé en masse corporelle et musculaire. Elle doit rester accompagnée d'une alimentation équilibrée et d'une bonne hydratation.",
  },
  {
    number: "05",
    title: "Précautions importantes",
    category: "Sécurité",
    readTime: "3 min",
    excerpt:
      "Mass Gainer n'est pas recommandé aux femmes enceintes, aux enfants de moins de 14 ans, ni aux personnes diabétiques ou hypertendues.",
    body:
      "Cette information doit être visible avant l'achat. Pour toute situation médicale particulière, le client doit demander l'avis d'un professionnel de santé avant consommation.",
  },
  {
    number: "06",
    title: "Super Grow pour enfants",
    category: "Produit enfant",
    readTime: "5 min",
    excerpt:
      "Super Grow est une bouillie nutritionnelle bio d'origine végétale pour les enfants de 1 à 13 ans.",
    body:
      "Le paquet de 800 g correspond à environ 20 jours de consommation par enfant. La formule est pensée pour les enfants qui ont du mal à manger, manquent d'appétit ou ont besoin d'un soutien nutritionnel.",
  },
  {
    number: "07",
    title: "Objectif de Super Grow",
    category: "Famille",
    readTime: "3 min",
    excerpt:
      "La formule enfant est présentée comme une aide pour favoriser une prise de poids saine et progressive.",
    body:
      "Elle doit accompagner les repas, pas les remplacer. Les parents doivent suivre l'appétit, l'énergie, la tolérance et l'évolution de l'enfant au fil des jours.",
  },
  {
    number: "08",
    title: "Peanut Butter bio",
    category: "Complément",
    readTime: "3 min",
    excerpt:
      "Le Peanut Butter est un beurre de cacahuète sans sucre, sans sel et sans huile ajoutée.",
    body:
      "La marque recommande de le mélanger avec la bouillie de protéines adulte ou la bouillie nutritionnelle enfant pour enrichir la routine et rendre la consommation plus gourmande.",
  },
  {
    number: "09",
    title: "Résultats et régularité",
    category: "Résultats",
    readTime: "4 min",
    excerpt:
      "La marque parle de résultats visibles en deux semaines, mais la régularité reste la clé.",
    body:
      "Pour mieux suivre l'évolution, il est conseillé de noter le poids, l'appétit, l'énergie et les changements physiques. Les résultats peuvent varier d'une personne à l'autre.",
  },
  {
    number: "10",
    title: "Où commander et se renseigner",
    category: "Service client",
    readTime: "5 min",
    excerpt:
      "Le service client accompagne les clientes selon leur ville : Kinshasa, Katanga, Pointe-Noire ou Brazzaville.",
    body:
      "Pour Katanga, le contact utilisé est +243 810 113 198. Pour Pointe-Noire : +242 06 531 3192. Pour Brazzaville : +242 05 671 9462. La commande du site redirige vers le bon WhatsApp selon la ville choisie.",
  },
];

function BlogPage() {
  return (
    <>
      <section className="bg-espresso text-cream">
        <div className="container-page py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="eyebrow mb-4 text-gold">Blog & conseils</div>
            <h1 className="font-display text-5xl leading-tight md:text-7xl">
              Mieux comprendre nos produits avant de commander.
            </h1>
            <p className="mt-6 max-w-2xl text-cream/75">
              Contenu inspiré des informations publiques de la marque : Mass Gainer, Super Grow,
              Peanut Butter, bénéfices, précautions et accompagnement WhatsApp.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/products" className="inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-espresso hover:bg-gold">
                Découvrir les produits <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-2 rounded-full border border-cream/20 px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-cream/90 hover:bg-cream/10">
                Parler à l'équipe
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-18 md:py-24">
        <div className="mb-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: Leaf, title: "Origine végétale", text: "Bouillies bio d'origine végétale pour adultes et enfants." },
            { icon: Sparkles, title: "Prise de poids saine", text: "Des routines pensées pour soutenir l'appétit et l'assimilation." },
            { icon: BookOpen, title: "10 contenus réels", text: "Informations reprises et restructurées depuis l'ancien site de la marque." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <Icon className="mb-4 h-5 w-5 text-copper" />
              <h2 className="font-display text-xl text-espresso">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {articles.map((article) => (
            <article key={article.number} id={`guide-${article.number}`} className="group overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-elegant">
              <div className="grid min-h-full sm:grid-cols-[0.38fr_0.62fr]">
                <div className="relative flex min-h-56 flex-col justify-between bg-espresso p-7 text-cream">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(216,166,92,0.28),transparent_36%)]" />
                  <div className="relative text-xs uppercase tracking-[0.22em] text-gold">{article.category}</div>
                  <div className="relative font-display text-7xl text-cream/90">{article.number}</div>
                </div>
                <div className="p-7">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{article.readTime}</div>
                  <h2 className="mt-3 font-display text-3xl text-espresso">{article.title}</h2>
                  <p className="mt-4 text-sm leading-relaxed text-espresso/75">{article.excerpt}</p>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{article.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
