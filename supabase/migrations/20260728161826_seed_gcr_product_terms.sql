-- seed_gcr_product_terms
--
-- Seeds product_term_es/en into GCR's businesses.settings so the generic
-- relay_quote_to_client function produces GCR-correct messages.
-- Default fallback in agent.py is 'Rental'/'Alquiler' for any other business.

UPDATE businesses
SET settings = settings || jsonb_build_object(
  'product_term_en', 'Golf Cart',
  'product_term_es', 'Carrito de golf'
)
WHERE slug = 'golfcartrentalscr';
