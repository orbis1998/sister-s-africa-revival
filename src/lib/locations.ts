export interface City {
  name: string;
  communes: string[];
  whatsapp?: string;
  whatsappDisplay?: string;
}

export interface Country {
  code: "CD" | "CG";
  name: string;
  whatsapp: string; // E.164 without +
  whatsappDisplay: string;
  currency: "FCFA" | "FCFA";
  cities: City[];
}

export const countries: Country[] = [
  {
    code: "CD",
    name: "République Démocratique du Congo",
    whatsapp: "243994186790",
    whatsappDisplay: "+243 994 186 790",
    currency: "FCFA",
    cities: [
      {
        name: "Kinshasa",
        whatsapp: "243994186790",
        whatsappDisplay: "+243 994 186 790",
        communes: [
          "Gombe",
          "Kintambo",
          "Lingwala",
          "Bandalungwa",
          "Kasavubu",
          "Kalamu",
          "Ngiri-Ngiri",
          "Selembao",
          "Bumbu",
          "Makala",
          "Ngaba",
          "Limete",
          "Matete",
          "Lemba",
          "Mont-Ngafula",
          "Ngaliema",
          "Masina",
          "Kimbanseke",
          "N'djili",
          "N'sele",
          "Maluku",
          "Barumbu",
          "Kinshasa",
        ],
      },
      {
        name: "Lubumbashi",
        whatsapp: "243810113198",
        whatsappDisplay: "+243 810 113 198",
        communes: ["Lubumbashi", "Kampemba", "Kenya", "Katuba", "Rwashi", "Annexe"],
      },
      { name: "Kolwezi", whatsapp: "243810113198", whatsappDisplay: "+243 810 113 198", communes: ["Manika", "Dilala"] },
      { name: "Likasi", whatsapp: "243810113198", whatsappDisplay: "+243 810 113 198", communes: ["Likasi", "Panda", "Shituru"] },
      { name: "Matadi", communes: ["Matadi", "Nzanza", "Mvuzi"] },
    ],
  },
  {
    code: "CG",
    name: "République du Congo (Brazzaville)",
    whatsapp: "242056719462",
    whatsappDisplay: "+242 05 671 9462",
    currency: "FCFA",
    cities: [
      {
        name: "Brazzaville",
        whatsapp: "242056719462",
        whatsappDisplay: "+242 05 671 9462",
        communes: [
          "Bacongo",
          "Makélékélé",
          "Poto-Poto",
          "Moungali",
          "Ouenzé",
          "Talangaï",
          "Mfilou",
          "Madibou",
          "Djiri",
        ],
      },
      {
        name: "Pointe-Noire",
        whatsapp: "242065313192",
        whatsappDisplay: "+242 06 531 3192",
        communes: ["Lumumba", "Mvou-Mvou", "Tié-Tié", "Loandjili", "Mongo-Mpoukou", "Ngoyo"],
      },
    ],
  },
];

export const findCountry = (code: string) => countries.find((c) => c.code === code);
