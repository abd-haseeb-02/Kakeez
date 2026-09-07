-- The business moved to Johar Town, Lahore, but the only delivery zone was
-- still named/keyed "Karachi". compute_delivery_minor matches on lower(city),
-- so with the checkout default now "Lahore" the city lookup would miss and fall
-- through to the cheapest active method. Renaming the zone makes the match real.
UPDATE public.delivery_zones
   SET name = 'Lahore', city = 'Lahore'
 WHERE lower(city) = 'karachi';

UPDATE public.delivery_methods
   SET name = 'Standard Lahore delivery'
 WHERE name = 'Standard Karachi delivery';
