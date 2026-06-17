import massGainerImg from "@/assets/mass-gainer.jpg";
import superGrowImg from "@/assets/super-grow.jpg";
import peanutButterImg from "@/assets/peanut-butter.jpg";

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  description: string;
  image: string;
  bestSeller?: boolean;
  variants: { id: string; label: string; priceFcfa: number; priceUsd: number; duration: string }[];
  benefits: string[];
  composition?: string[];
  warning?: string;
  ageRange: string;
}

export const products: Product[] = [
  {
    slug: "mass-gainer",
    name: "Mass Gainer",
    tagline: "Bouillie de protéines · Adultes 14+",
    category: "Pour Adultes",
    bestSeller: true,
    description:
      "Une bouillie de protéines bio d'origine végétale, spécialement conçue pour favoriser une prise de poids saine et naturelle. Résultats visibles dès deux semaines de consommation régulière. Formulée pour hommes et femmes à partir de 14 ans.",
    image: massGainerImg,
    ageRange: "À partir de 14 ans",
    variants: [
      { id: "1kg", label: "1 kg — 2 semaines", priceFcfa: 10500, priceUsd: 15, duration: "2 semaines de consommation" },
      { id: "2kg", label: "2 kg — 1 mois", priceFcfa: 16500, priceUsd: 25, duration: "1 mois de consommation" },
    ],
    benefits: [
      "Stimule l'appétit naturellement",
      "Renforce la densité osseuse",
      "Ralentit le métabolisme",
      "Construit la masse musculaire",
      "Prise de 3 à 6 kg en deux semaines",
    ],
    warning:
      "Déconseillé aux femmes enceintes, aux enfants de moins de 14 ans, ainsi qu'aux personnes souffrant de diabète ou d'hypertension.",
  },
  {
    slug: "super-grow",
    name: "Super Grow",
    tagline: "Bouillie nutritionnelle · Enfants 1 à 13 ans",
    category: "Pour Enfants",
    bestSeller: true,
    description:
      "Bouillie nutritionnelle bio d'origine végétale pour enfants de 1 à 13 ans. Un paquet de 800g pour 20 jours de consommation. Formulée pour soutenir une croissance saine.",
    image: superGrowImg,
    ageRange: "1 à 13 ans",
    variants: [
      { id: "800g", label: "800 g — 20 jours", priceFcfa: 10500, priceUsd: 15, duration: "20 jours de consommation" },
    ],
    benefits: [
      "Stimule l'appétit",
      "Entretient la santé osseuse",
      "Aide le système digestif",
      "Favorise la croissance musculaire",
      "Ralentit le métabolisme",
    ],
    composition: [
      "Stéarate de magnésium végétal",
      "Fruits de moine",
      "Gruau d'avoine",
      "Graines de mil",
      "Graines de chardon",
      "Fèves de cacao",
    ],
  },
  {
    slug: "peanut-butter",
    name: "Peanut Butter",
    tagline: "Beurre de cacahouète bio · Sans additifs",
    category: "Complément",
    description:
      "Beurre de cacahouète 100% naturel, sans sucre, sans sel et sans huile rajoutée. À mélanger avec le Mass Gainer ou le Super Grow pour augmenter l'apport calorique et la qualité nutritionnelle.",
    image: peanutButterImg,
    ageRange: "Tout public",
    variants: [
      { id: "pot", label: "Pot — 250g", priceFcfa: 3500, priceUsd: 5, duration: "Consommation libre" },
    ],
    benefits: [
      "Excellente source de protéines",
      "Bonnes graisses essentielles",
      "Augmente l'apport calorique",
      "Idéal pour la prise de masse",
      "Sans sucre, sans sel, sans huile ajoutée",
    ],
  },
];

export const getProduct = (slug: string) => products.find((p) => p.slug === slug);

export const formatPrice = (fcfa: number, usd: number) =>
  `${fcfa.toLocaleString("fr-FR")} FCFA · $${usd}`;
