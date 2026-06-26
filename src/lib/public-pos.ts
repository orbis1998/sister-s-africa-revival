import { supabase } from "@/integrations/supabase/client";

export type PosPublicListing = "retail" | "expedition" | "contact";

export type PublicPointOfSale = {
  id: string;
  name: string;
  city: string | null;
  city_scope: string | null;
  address: string | null;
  phone: string | null;
  public_note: string | null;
  public_listing: PosPublicListing;
};

export async function fetchPublicPointsOfSale(listing?: PosPublicListing | PosPublicListing[]) {
  let query = supabase
    .from("points_of_sale")
    .select("id, name, city, city_scope, address, phone, public_note, public_listing")
    .order("name");

  const listings = listing ? (Array.isArray(listing) ? listing : [listing]) : null;
  if (listings?.length) query = query.in("public_listing", listings);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicPointOfSale[];
}
