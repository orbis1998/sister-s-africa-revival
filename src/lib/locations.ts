export interface CommuneDef {
  name: string;
  zones?: string[];
}

export interface City {
  name: string;
  communes: CommuneDef[];
  whatsapp?: string;
  whatsappDisplay?: string;
}

export interface Country {
  code: "CD" | "CG";
  name: string;
  whatsapp: string;
  whatsappDisplay: string;
  currency: "USD" | "FCFA";
  cities: City[];
}

const kinshasaCommunes: CommuneDef[] = [
  { name: "Gombe" },
  { name: "Lingwala" },
  { name: "Kinshasa" },
  { name: "Kintambo", zones: ["Mimosa", "Mont Fleuri", "Babylone", "Jamaïque", "Komorico"] },
  { name: "Kalamu", zones: ["Victoire", "Matonge", "Yolo", "Kimwenza"] },
  { name: "Bandalungwa" },
  { name: "Ngaliema", zones: ["GB", "Macampagne", "Ozone", "Golf", "Delvaux", "Pigeon", "UPN", "Pompage"] },
  { name: "Barumbu", zones: ["Barumbu", "Baramoto", "Kasaï"] },
  { name: "Kasa-Vubu" },
  { name: "Ngiri-Ngiri" },
  { name: "Makala" },
  { name: "Ngaba" },
  { name: "Kisenso" },
  { name: "Matete" },
  { name: "Selembao" },
  { name: "Bumbu" },
  { name: "Limete" },
  { name: "Masina", zones: ["Ndjili"] },
  { name: "Mont-Ngafula", zones: ["Liyolo", "Cité Verte", "Camp Badiading", "Mitendi"] },
  { name: "Lemba", zones: ["Salongo", "Super", "Livulu", "Terminus", "Imbu"] },
  { name: "Plateau" },
  { name: "Matadi Kibala" },
  { name: "Mokali" },
  { name: "Sekomaf" },
  { name: "Kingasani" },
  { name: "Maluku" },
  { name: "Nsele" },
  { name: "Aéroport de N'Djili" },
  { name: "Sangamamba" },
];

function simpleCommunes(names: string[]): CommuneDef[] {
  return names.map((name) => ({ name }));
}

export const countries: Country[] = [
  {
    code: "CD",
    name: "République Démocratique du Congo",
    whatsapp: "243994186790",
    whatsappDisplay: "+243 994 186 790",
    currency: "USD",
    cities: [
      {
        name: "Kinshasa",
        whatsapp: "243994186790",
        whatsappDisplay: "+243 994 186 790",
        communes: kinshasaCommunes,
      },
      {
        name: "Lubumbashi",
        whatsapp: "243810113198",
        whatsappDisplay: "+243 810 113 198",
        communes: simpleCommunes(["Lubumbashi", "Kampemba", "Kenya", "Katuba", "Rwashi", "Annexe"]),
      },
      { name: "Kolwezi", whatsapp: "243810113198", whatsappDisplay: "+243 810 113 198", communes: simpleCommunes(["Manika", "Dilala"]) },
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
        communes: simpleCommunes([
          "Bacongo",
          "Makélékélé",
          "Poto-Poto",
          "Moungali",
          "Ouenzé",
          "Talangaï",
          "Mfilou",
          "Madibou",
          "Djiri",
        ]),
      },
      {
        name: "Pointe-Noire",
        whatsapp: "242065313192",
        whatsappDisplay: "+242 06 531 3192",
        communes: simpleCommunes(["Lumumba", "Mvou-Mvou", "Tié-Tié", "Loandjili", "Mongo-Mpoukou", "Ngoyo"]),
      },
    ],
  },
];

export const findCountry = (code: string) => countries.find((c) => c.code === code);

export function findCommune(city: City | undefined, communeName: string): CommuneDef | undefined {
  return city?.communes.find((c) => c.name === communeName);
}

export function communeHasZones(city: City | undefined, communeName: string) {
  const commune = findCommune(city, communeName);
  return (commune?.zones?.length ?? 0) > 0;
}

export function communeZones(city: City | undefined, communeName: string): string[] {
  return findCommune(city, communeName)?.zones ?? [];
}

export function deliveryLocationLabel(commune: string, zone?: string) {
  if (zone?.trim()) return `${commune} · ${zone}`;
  return commune;
}
