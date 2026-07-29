-- innova_catalog_seed
-- Categorías y productos de Innova CR desde Precios Mercadeo.xlsx
-- Precios finales (ya con descuento aplicado). Precio base por m² o unidad en USD.

do $$
declare
  bid  uuid := '3f6d24c8-428d-4db0-a3a7-f4877135111c';
  c1   uuid := gen_random_uuid();
  c2   uuid := gen_random_uuid();
  c3   uuid := gen_random_uuid();
  c4   uuid := gen_random_uuid();
  c5   uuid := gen_random_uuid();
  c6   uuid := gen_random_uuid();
  c7   uuid := gen_random_uuid();
  c8   uuid := gen_random_uuid();
  c9   uuid := gen_random_uuid();
begin

  -- Limpiar datos previos de Innova para re-seed limpio
  delete from price_items        where business_id = bid;
  delete from product_categories where business_id = bid;

  -- Categorías
  insert into product_categories (id, business_id, name, sort_order) values
    (c1, bid, 'Arrollables',                   1),
    (c2, bid, 'Romanas',                        2),
    (c3, bid, 'Panel Deslizante',              3),
    (c4, bid, 'Persiana de Madera',            4),
    (c5, bid, 'Zebra / Sheer / Double Roller', 5),
    (c6, bid, 'Persianas Verticales',          6),
    (c7, bid, 'Toldos Retráctiles',            7),
    (c8, bid, 'Deck',                           8),
    (c9, bid, 'Piso PVC',                       9);

  -- Arrollables (precio por m²)
  insert into price_items (business_id, category_id, name, price, unit, description, sort_order) values
    (bid, c1, 'Black Out',   41.23, 'm²', 'Precio por m². Mín. 1m×1m. Si ancho >2.80m precio×1.15; >3.50m precio×1.30. No incluye instalación.',  1),
    (bid, c1, 'Screen',      42.50, 'm²', 'Precio por m². Mín. 1m×1m. Si ancho >2.80m precio×1.15; >3.50m precio×1.30. No incluye instalación.',  2),
    (bid, c1, 'Decorativas', 42.50, 'm²', 'Precio por m². Mín. 1m×1m. Si ancho >2.80m precio×1.15; >3.50m precio×1.30. No incluye instalación.',  3);

  -- Romanas (precio por m²)
  insert into price_items (business_id, category_id, name, price, unit, description, sort_order) values
    (bid, c2, 'Black Out',   46.75, 'm²', 'Precio por m². Mín. 1m×1m. Hasta 3m de ancho. No incluye instalación.', 1),
    (bid, c2, 'Decorativas', 44.20, 'm²', 'Precio por m². Mín. 1m×1m. Hasta 3m de ancho. No incluye instalación.', 2),
    (bid, c2, 'Traslúcidas', 44.20, 'm²', 'Precio por m². Mín. 1m×1m. Hasta 3m de ancho. No incluye instalación.', 3);

  -- Panel Deslizante (precio por m²)
  insert into price_items (business_id, category_id, name, price, unit, description, sort_order) values
    (bid, c3, 'Black Out',   63.75, 'm²', 'Precio por m². Mín. 1m×1m. No incluye instalación ni accesorios especiales.', 1),
    (bid, c3, 'Screen',      63.75, 'm²', 'Precio por m². Mín. 1m×1m. No incluye instalación ni accesorios especiales.', 2),
    (bid, c3, 'Decorativas', 63.75, 'm²', 'Precio por m². Mín. 1m×1m. No incluye instalación ni accesorios especiales.', 3);

  -- Persiana de Madera (precio por m²)
  insert into price_items (business_id, category_id, name, price, unit, description, sort_order) values
    (bid, c4, 'Madera', 96.90, 'm²', 'Precio por m². Mín. 1m×1m. Hasta 2.60m de ancho. No incluye instalación ni accesorios especiales.', 1);

  -- Zebra / Sheer / Double Roller (precio por m²)
  insert into price_items (business_id, category_id, name, price, unit, description, sort_order) values
    (bid, c5, 'Premium',      90.10, 'm²', 'Precio por m². Mín. 1m×1m. Hasta 3m de ancho. No incluye instalación ni accesorios especiales.', 1),
    (bid, c5, 'Semi Blackout', 90.10, 'm²', 'Precio por m². Mín. 1m×1m. Hasta 3m de ancho. No incluye instalación ni accesorios especiales.', 2);

  -- Persianas Verticales (precio compuesto)
  insert into price_items (business_id, category_id, name, price, unit, description, sort_order) values
    (bid, c6, 'PVC Liso',    15.73, 'm²',      'Material por m². Total = (ancho×riel) + (ancho×cenefa) + (ancho×alto×material). Mín. 1m×1m.', 1),
    (bid, c6, 'PVC Diseño',  36.98, 'm²',      'Material por m². Total = (ancho×riel) + (ancho×cenefa) + (ancho×alto×material). Mín. 1m×1m.', 2),
    (bid, c6, 'PVC Tela',    17.85, 'm²',      'Material por m². Total = (ancho×riel) + (ancho×cenefa) + (ancho×alto×material). Mín. 1m×1m.', 3),
    (bid, c6, 'Riel',        20.49, 'm lineal', 'Se cobra por metro lineal de ancho, adicional al material.',                                   4),
    (bid, c6, 'Cenefa',       9.35, 'm lineal', 'Se cobra por metro lineal de ancho, adicional al material.',                                   5);

  -- Toldos Retráctiles (precio fijo por unidad, incluye instalación)
  insert into price_items (business_id, category_id, name, price, unit, description, sort_order) values
    (bid, c7, 'Retráctil 2.90m×2.00m manual',     450.00, 'unidad', 'Precio fijo. Incluye instalación. Aplican restricciones.',              1),
    (bid, c7, 'Retráctil 3.95m×2.50m manual',     540.00, 'unidad', 'Precio fijo. Incluye instalación. Aplican restricciones.',              2),
    (bid, c7, 'Retráctil 3.95m×2.50m motorizado', 720.00, 'unidad', 'Precio fijo con motor. Incluye instalación. Aplican restricciones.',    3);

  -- Deck (precio por m²)
  insert into price_items (business_id, category_id, name, price, unit, description, sort_order) values
    (bid, c8, 'Deck', 85.50, 'm²', 'Precio por m². No incluye instalación ni estructura en tubo galvanizado de 2". Aplican restricciones.', 1);

  -- Piso PVC (precio por m²)
  insert into price_items (business_id, category_id, name, price, unit, description, sort_order) values
    (bid, c9, 'Piso PVC 5mm', 27.00, 'm²', 'Precio por m². No incluye instalación. Aplican restricciones.', 1);

end $$;
