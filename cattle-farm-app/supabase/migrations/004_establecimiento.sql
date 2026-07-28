ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS hectareas_totales         numeric(10,2),
  ADD COLUMN IF NOT EXISTS hectareas_pastoreo        numeric(10,2),
  ADD COLUMN IF NOT EXISTS sistema_produccion        text,   -- cria | recria | engorde | ciclo_completo
  ADD COLUMN IF NOT EXISTS tipo_campo                text,   -- campo_natural | mejorado | cultivado | mixto
  ADD COLUMN IF NOT EXISTS mes_inicio_temporada      integer, -- 1-12
  ADD COLUMN IF NOT EXISTS duracion_temporada_dias   integer,
  ADD COLUMN IF NOT EXISTS edad_destete_dias         integer,
  ADD COLUMN IF NOT EXISTS tasa_prenez_objetivo      numeric(5,2), -- 0-100
  ADD COLUMN IF NOT EXISTS tasa_mortalidad_esperada  numeric(5,2), -- 0-100
  ADD COLUMN IF NOT EXISTS gdp_objetivo              numeric(5,3),
  ADD COLUMN IF NOT EXISTS gastos_fijos_mensuales    numeric(12,2),
  ADD COLUMN IF NOT EXISTS costo_veterinario_anual   numeric(12,2),
  ADD COLUMN IF NOT EXISTS precio_ternero_reposicion numeric(12,2),
  ADD COLUMN IF NOT EXISTS notas_generales           text;
