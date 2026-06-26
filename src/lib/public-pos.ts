import { supabase } from "@/integrations/supabase/client";

export type PublicPointOfSale = {
  id: string;
  name: string;
  city: string | null;
  city_scope: string | null;
  address: string | null;
  phone: string | null;
  public_note: string | null;
};

export async function fetchPublicPointsOfSale(): Promise<PublicPointOfSale[]> {
  const { data, error } = await supabase
    .from("points_of_sale")
    .select("id, name, city, city_scope, address, phone, public_note")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicPointOfSale[];
}
