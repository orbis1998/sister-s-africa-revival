-- Bureau Kinshasa : page Contact uniquement (pas Points de vente)

UPDATE public.points_of_sale
SET public_listing = 'contact'
WHERE name ILIKE '%BUREAU KINSHASA%'
   OR (name ILIKE '%KINSHASA%' AND (address ILIKE '%Kintambo%' OR city ILIKE '%KINSHASA%'));

-- Les 5 contacts restent sur Contact
UPDATE public.points_of_sale
SET public_listing = 'contact'
WHERE public_listing = 'retail'
  AND (
    name ILIKE '%BRAZZA%'
    OR name ILIKE '%BUREAU KINSHASA%'
    OR name ILIKE '%KOLWEZI%'
    OR name ILIKE '%LUBUMBASHI%'
    OR name ILIKE '%POINTE%NOIRE%'
    OR name ILIKE '%POINTE-N%'
  );
