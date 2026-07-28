-- ============================================================
-- DEMO SEED DATA — based on actual farm sheets (17-Jul-26)
-- All values derived from the two reference images.
-- Handwritten/uncertain values marked with source='importacion_foto'
-- ============================================================

-- Use fixed UUIDs for demo data so re-seeding is idempotent
do $$
declare
  v_farm_id     uuid := 'a1b2c3d4-0001-0001-0001-000000000001';
  v_user_id     uuid := 'a1b2c3d4-0001-0001-0001-000000000002';

  -- Lots
  v_lot_l2 uuid := 'a1b2c3d4-0002-0002-0002-000000000001';
  v_lot_l3 uuid := 'a1b2c3d4-0002-0002-0002-000000000002';
  v_lot_l4 uuid := 'a1b2c3d4-0002-0002-0002-000000000003';
  v_lot_l5 uuid := 'a1b2c3d4-0002-0002-0002-000000000004';
  v_lot_l6 uuid := 'a1b2c3d4-0002-0002-0002-000000000005';

  -- Cow IDs (reproductoras)
  v_cow_58   uuid := 'a1b2c3d4-0003-0003-0003-000000000001';
  v_cow_60   uuid := 'a1b2c3d4-0003-0003-0003-000000000002';
  v_cow_74   uuid := 'a1b2c3d4-0003-0003-0003-000000000003';
  v_cow_95   uuid := 'a1b2c3d4-0003-0003-0003-000000000004';
  v_cow_99   uuid := 'a1b2c3d4-0003-0003-0003-000000000005';
  v_cow_100  uuid := 'a1b2c3d4-0003-0003-0003-000000000006';
  v_cow_103  uuid := 'a1b2c3d4-0003-0003-0003-000000000007';
  v_cow_104  uuid := 'a1b2c3d4-0003-0003-0003-000000000008';
  v_cow_106  uuid := 'a1b2c3d4-0003-0003-0003-000000000009';
  v_cow_158  uuid := 'a1b2c3d4-0003-0003-0003-000000000010';
  v_cow_160  uuid := 'a1b2c3d4-0003-0003-0003-000000000011';
  v_cow_165  uuid := 'a1b2c3d4-0003-0003-0003-000000000012';
  v_cow_166  uuid := 'a1b2c3d4-0003-0003-0003-000000000013';
  v_cow_168  uuid := 'a1b2c3d4-0003-0003-0003-000000000014';
  v_cow_170  uuid := 'a1b2c3d4-0003-0003-0003-000000000015';
  v_cow_198  uuid := 'a1b2c3d4-0003-0003-0003-000000000016';
  v_cow_227  uuid := 'a1b2c3d4-0003-0003-0003-000000000017';
  v_cow_426  uuid := 'a1b2c3d4-0003-0003-0003-000000000018';
  v_cow_1002 uuid := 'a1b2c3d4-0003-0003-0003-000000000019';
  v_cow_1009 uuid := 'a1b2c3d4-0003-0003-0003-000000000020';
  v_cow_talla uuid := 'a1b2c3d4-0003-0003-0003-000000000021';
  v_cow_chavela uuid := 'a1b2c3d4-0003-0003-0003-000000000022';

  -- Young animal IDs
  -- 1009 appears on both sheets — same physical animal, reuse cow UUID
  v_an_1009 uuid := 'a1b2c3d4-0003-0003-0003-000000000020';
  v_an_1012 uuid := 'a1b2c3d4-0004-0004-0004-000000000002';
  v_an_1015 uuid := 'a1b2c3d4-0004-0004-0004-000000000003';
  v_an_1016 uuid := 'a1b2c3d4-0004-0004-0004-000000000004';
  v_an_1017 uuid := 'a1b2c3d4-0004-0004-0004-000000000005';
  v_an_1018 uuid := 'a1b2c3d4-0004-0004-0004-000000000006';
  v_an_1019 uuid := 'a1b2c3d4-0004-0004-0004-000000000007';
  v_an_1020 uuid := 'a1b2c3d4-0004-0004-0004-000000000008';
  v_an_1021 uuid := 'a1b2c3d4-0004-0004-0004-000000000009';
  v_an_1022 uuid := 'a1b2c3d4-0004-0004-0004-000000000010';
  v_an_1023 uuid := 'a1b2c3d4-0004-0004-0004-000000000011';
  v_an_1024 uuid := 'a1b2c3d4-0004-0004-0004-000000000012';
  v_an_1025 uuid := 'a1b2c3d4-0004-0004-0004-000000000013';
  v_an_1026 uuid := 'a1b2c3d4-0004-0004-0004-000000000014';
  v_an_1027 uuid := 'a1b2c3d4-0004-0004-0004-000000000015';
  v_an_1028 uuid := 'a1b2c3d4-0004-0004-0004-000000000016';
  v_an_1029 uuid := 'a1b2c3d4-0004-0004-0004-000000000017';

  v_breed_brangus_n uuid;
  v_breed_br        uuid;
  v_breed_br_gyr    uuid;

begin

  -- Get breed IDs
  select id into v_breed_brangus_n from breeds where abbreviation = 'Brangus N' and is_system = true limit 1;
  select id into v_breed_br        from breeds where abbreviation = 'BR' and is_system = true limit 1;
  select id into v_breed_br_gyr    from breeds where abbreviation = 'Br Gyr Ho' and is_system = true limit 1;

  -- ============================================================
  -- DEMO FARM
  -- ============================================================
  insert into farms (id, name, country, region, currency, weight_unit,
    production_type, production_stage, production_system,
    target_sale_weight, expected_price_per_kg, daily_cost_per_animal)
  values (v_farm_id, 'Establecimiento Demo', 'Uruguay', 'Soriano', 'USD', 'kg',
    'carne', 'ciclo_completo', 'extensivo',
    450, 3.20, 1.50)
  on conflict (id) do nothing;

  -- ============================================================
  -- LOTS (from the two sheets: L2-L6)
  -- ============================================================
  insert into lots (id, farm_id, name, production_category, status, entry_date) values
    (v_lot_l2, v_farm_id, 'L2', 'recria', 'activo', '2025-03-01'),
    (v_lot_l3, v_farm_id, 'L3', 'recria', 'activo', '2025-06-01'),
    (v_lot_l4, v_farm_id, 'L4', 'recria', 'activo', '2025-11-01'),
    (v_lot_l5, v_farm_id, 'L5', 'recria', 'activo', '2026-03-01'),
    (v_lot_l6, v_farm_id, 'L6', 'cria',   'activo', '2026-05-01')
  on conflict (id) do nothing;

  -- ============================================================
  -- COWS (reproductoras from sheet 2)
  -- ============================================================
  insert into animals (id, farm_id, display_id, category, sex, breed_id, status, current_lot_id) values
    (v_cow_58,    v_farm_id, '58',    'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l4),
    (v_cow_60,    v_farm_id, '60',    'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l4),
    (v_cow_74,    v_farm_id, '74',    'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l4),
    (v_cow_95,    v_farm_id, '95',    'vaca_reproductora', 'H', v_breed_br,        'activo', v_lot_l4),
    (v_cow_99,    v_farm_id, '99',    'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l4),
    (v_cow_100,   v_farm_id, '100',   'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l4),
    (v_cow_103,   v_farm_id, '103',   'vaca_reproductora', 'H', v_breed_br,        'activo', v_lot_l4),
    (v_cow_104,   v_farm_id, '104',   'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l4),
    (v_cow_106,   v_farm_id, '106',   'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l5),
    (v_cow_158,   v_farm_id, '158',   'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l5),
    (v_cow_160,   v_farm_id, '160',   'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l5),
    (v_cow_165,   v_farm_id, '165',   'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l6),
    (v_cow_166,   v_farm_id, '166',   'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l5),
    (v_cow_168,   v_farm_id, '168',   'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l6),
    (v_cow_170,   v_farm_id, '170',   'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l6),
    (v_cow_198,   v_farm_id, '198',   'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l5),
    (v_cow_227,   v_farm_id, '227',   'vaca_reproductora', 'H', v_breed_br_gyr,    'activo', v_lot_l4),
    (v_cow_426,   v_farm_id, '426',   'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l4),
    (v_cow_1002,  v_farm_id, '1002',  'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l5),
    (v_cow_1009,  v_farm_id, '1009',  'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l5),
    (v_cow_talla,  v_farm_id, 'Talla',  'vaca_reproductora', 'H', v_breed_brangus_n, 'activo', v_lot_l6),
    (v_cow_chavela, v_farm_id, 'Chavela', 'vaca_reproductora', 'H', null, 'activo', v_lot_l6)
  on conflict (farm_id, display_id) do nothing;

  -- ============================================================
  -- YOUNG ANIMALS (animales jóvenes from sheet 1, 17-Jul-26)
  -- ============================================================
  insert into animals (id, farm_id, display_id, category, sex, breed_id, breed_raw,
    birth_date, mother_id, mother_display_id, father_name, current_lot_id) values
    -- L2
    (v_an_1009, v_farm_id, '1009', 'hembra_joven', 'H', v_breed_br, 'BR',
      '2025-02-23', v_cow_95, '95', 'THIERRY', v_lot_l2),
    -- L3
    (v_an_1012, v_farm_id, '1012', 'hembra_joven', 'H', v_breed_br, 'BR',
      '2025-04-01', v_cow_103, '103', 'THIERRY', v_lot_l3),
    -- L4
    (v_an_1015, v_farm_id, '1015', 'macho_joven', 'M', v_breed_brangus_n, 'Brangus N',
      '2025-11-16', v_cow_426, '426', 'Son in Law', v_lot_l4),
    (v_an_1016, v_farm_id, '1016', 'hembra_joven', 'H', v_breed_brangus_n, 'Brangus N',
      '2025-11-17', v_cow_100, '100', 'Columbus', v_lot_l4),
    (v_an_1017, v_farm_id, '1017', 'macho_joven', 'M', v_breed_br_gyr, 'Br Gyr Ho',
      '2025-11-21', v_cow_227, '227', 'Vega', v_lot_l4),
    (v_an_1018, v_farm_id, '1018', 'macho_joven', 'M', v_breed_br_gyr, 'Br Gyr Ho',
      '2025-11-22', v_cow_227, '227', 'Vega', v_lot_l4),
    (v_an_1019, v_farm_id, '1019', 'macho_joven', 'M', v_breed_brangus_n, 'Brangus N',
      '2025-11-22', v_cow_74, '74', 'Columbus', v_lot_l4),
    -- L5
    (v_an_1020, v_farm_id, '1020', 'macho_joven', 'M', v_breed_brangus_n, 'Brangus N',
      '2026-03-14', v_cow_95, '95', 'Townsend', v_lot_l5),
    (v_an_1021, v_farm_id, '1021', 'hembra_joven', 'H', v_breed_brangus_n, 'Brangus N',
      '2026-03-20', v_cow_103, '103', 'Townsend', v_lot_l5),
    (v_an_1022, v_farm_id, '1022', 'hembra_joven', 'H', v_breed_brangus_n, 'Brangus N',
      '2026-03-23', v_cow_166, '166', 'Townsend', v_lot_l5),
    (v_an_1023, v_farm_id, '1023', 'hembra_joven', 'H', v_breed_brangus_n, 'Brangus N',
      '2026-03-27', v_cow_106, '106', 'Townsend', v_lot_l5),
    (v_an_1024, v_farm_id, '1024', 'macho_joven', 'M', v_breed_brangus_n, 'Brangus N',
      '2026-05-06', v_cow_158, '158', 'Benja', v_lot_l5),
    -- L6
    (v_an_1025, v_farm_id, '1025', 'hembra_joven', 'H', v_breed_brangus_n, 'Brangus N',
      '2026-05-07', v_cow_160, '160', 'Benja', v_lot_l6),
    (v_an_1026, v_farm_id, '1026', 'hembra_joven', 'H', v_breed_brangus_n, 'Brangus N',
      '2026-05-11', v_cow_168, '168', 'Benja', v_lot_l6),
    (v_an_1027, v_farm_id, '1027', 'macho_joven', 'M', v_breed_brangus_n, 'Brangus N',
      '2026-05-11', v_cow_170, '170', 'Benja', v_lot_l6),
    (v_an_1028, v_farm_id, '1028', 'hembra_joven', 'H', v_breed_brangus_n, 'BranglEGvr',
      '2026-05-19', v_cow_60, '60', 'Franco', v_lot_l6),
    (v_an_1029, v_farm_id, '1029', 'macho_joven', 'M', v_breed_brangus_n, 'Brangus N',
      '2026-05-21', v_cow_165, '165', 'Townsend', v_lot_l6)
  on conflict (farm_id, display_id) do nothing;

  -- ============================================================
  -- WEIGHT RECORDS (from Ultima Pesa column, 17-Jul-26)
  -- ============================================================
  insert into weight_records (farm_id, animal_id, weight_date, weight_kg, source, measurement_method) values
    (v_farm_id, v_an_1009, '2026-07-17', 364,   'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1012, '2026-07-17', 302,   'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1015, '2026-07-17', 252,   'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1016, '2026-07-17', 224,   'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1017, '2026-07-17', 138,   'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1018, '2026-07-17', 147.5, 'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1019, '2026-07-17', 219,   'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1020, '2026-07-17', 168.5, 'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1021, '2026-07-17', 159,   'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1022, '2026-07-17', 150,   'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1023, '2026-07-17', 143,   'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1024, '2026-07-17', 75.5,  'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1025, '2026-07-17', 87.5,  'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1026, '2026-07-17', 101,   'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1027, '2026-07-17', 91,    'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1028, '2026-07-17', 70.5,  'importacion_foto', 'balanza'),
    (v_farm_id, v_an_1029, '2026-07-17', 79.5,  'importacion_foto', 'balanza');

  -- ============================================================
  -- REPRODUCTIVE RECORDS (from sheet 2, Jul-26)
  -- confirmed pregnant = '++++++' → positivo
  -- DIV = en_protocolo
  -- Estado: Seca / Parida / Abierta / OK
  -- ============================================================
  insert into reproductive_records (
    farm_id, animal_id, service_date, bull_name, service_method,
    pregnancy_status, pregnancy_raw_value, actual_calving_date,
    expected_weaning_date, next_service_start_date,
    reproductive_status, calf_animal_id, observations
  ) values
    -- 58: Franco, ++++++, parto 19-May-26, calf H1028, Seca
    (v_farm_id, v_cow_58, '2026-01-14', 'Franco', 'monta_natural',
      'positivo', '++++++', '2026-05-19',
      '2027-01-19', '2026-10-21',
      'seca', v_an_1028, 'H1028 | 70.5kg | Palpar'),

    -- 60: Townsend, ++++++, Parida, calves referenced M1019+M1020
    (v_farm_id, v_cow_60, '2026-02-05', 'Townsend', 'monta_natural',
      'positivo', '++++++', null,
      '2026-07-22', '2026-11-12',
      'parida', null, 'M1019 | 210kg | M1020 | 168.5kg | Palpar'),

    -- 74: Townsend, ++++++, parto 14-Mar-26, Seca
    (v_farm_id, v_cow_74, '2026-06-05', 'Townsend', 'monta_natural',
      'positivo', '++++++', '2026-03-14',
      '2026-11-14', '2026-11-12',
      'seca', v_an_1020, 'M1020 | 168.5kg | Palpar'),

    -- 95: Townsend, ++++++, parto 17-Nov-25, Seca
    (v_farm_id, v_cow_95, '2026-06-05', 'Townsend', 'monta_natural',
      'positivo', '++++++', '2025-11-17',
      '2026-07-17', '2026-11-12',
      'seca', null, 'H1016 | 224kg | Palpar'),

    -- 99: Townsend, ++++++, parto 20-Mar-26, Abierta
    (v_farm_id, v_cow_99, '2026-06-05', 'Townsend', 'monta_natural',
      'positivo', '++++++', '2026-03-20',
      '2026-11-20', null,
      'abierta', null, 'Aborto | Palpar'),

    -- 100: Columbus, ++++++, parto 27-Mar-26, Parida
    (v_farm_id, v_cow_100, '2026-06-05', 'Townsend', 'monta_natural',
      'positivo', '++++++', '2026-03-27',
      '2026-11-27', '2026-11-20',
      'parida', null, 'H1023 | 143kg | Palpar'),

    -- 103: Townsend, ++++++, parto 27-Apr-26, Parida
    (v_farm_id, v_cow_103, '2026-05-27', 'Townsend', 'monta_natural',
      'positivo', '++++++', '2026-04-27',
      '2026-11-27', '2026-11-27',
      'parida', null, 'H1023 | 143kg | Palpar'),

    -- 104: Townsend, ++++++, parto 17-Nov-25, Parida
    (v_farm_id, v_cow_104, '2026-05-27', 'Townsend', 'monta_natural',
      'positivo', '++++++', '2025-11-17',
      '2026-07-17', '2026-11-17',
      'parida', null, 'H1021 | 159kg | Palpar'),

    -- 106: Townsend, ++++++, parto 5-Jun-26, Parida
    (v_farm_id, v_cow_106, '2026-05-05', 'Townsend', 'monta_natural',
      'positivo', '++++++', '2026-06-05',
      '2027-01-27', '2027-01-06',
      'parida', null, 'H1022 | 150kg | Palpar'),

    -- 158: Benja, DIV (en protocolo)
    (v_farm_id, v_cow_158, '2026-05-06', 'Benja', 'protocolo_div',
      'desconocido', 'DIV', null,
      null, '2027-01-06',
      'en_protocolo', null, 'DIV — protocolo sincronización'),

    -- 160: Benja, DIV (en protocolo)
    (v_farm_id, v_cow_160, '2026-05-07', 'Benja', 'protocolo_div',
      'desconocido', 'DIV', null,
      null, '2027-01-07',
      'en_protocolo', null, 'DIV — protocolo sincronización'),

    -- 165: Townsend, ++++++, parto 23-May-26, Parida
    (v_farm_id, v_cow_165, '2026-06-23', 'Townsend', 'monta_natural',
      'positivo', '++++++', '2026-05-23',
      '2027-01-23', '2027-01-06',
      'parida', null, 'M1029 | 150kg | Palpar'),

    -- 166: Townsend, DIV (en protocolo)
    (v_farm_id, v_cow_166, '2026-05-05', 'Townsend', 'protocolo_div',
      'desconocido', 'DIV', null,
      null, '2027-01-27',
      'en_protocolo', null, 'DIV — protocolo sincronización'),

    -- 168: Benja, ++++++, parto 11-May-26, Parida
    (v_farm_id, v_cow_168, '2026-05-11', 'Benja', 'monta_natural',
      'positivo', '++++++', '2026-05-11',
      '2027-01-11', '2027-01-11',
      'parida', v_an_1026, 'H1026 | 101kg | Palpar'),

    -- 170: Benja, ++++++, parto 11-May-26, Parida
    (v_farm_id, v_cow_170, '2026-05-11', 'Benja', 'monta_natural',
      'positivo', '++++++', '2026-05-11',
      '2027-01-11', '2027-01-11',
      'parida', v_an_1027, 'M1027 | 91kg | Palpar'),

    -- 198: Townsend, ++++++, Abierta
    (v_farm_id, v_cow_198, '2026-06-05', 'Townsend', 'monta_natural',
      'positivo', '++++++', null,
      null, '2026-11-21',
      'abierta', null, 'Aborto'),

    -- 227: Vega, ++++++, parto 22-Nov-25, Parida
    (v_farm_id, v_cow_227, '2026-06-22', 'Vega', 'monta_natural',
      'positivo', '++++++', '2025-11-22',
      '2026-07-22', '2026-11-12',
      'parida', null, 'M1017|138kg M1018|147.5kg | Palpar'),

    -- 1002: Townsend, ++++++, Seca
    (v_farm_id, v_cow_1002, '2026-02-05', 'Townsend', 'monta_natural',
      'positivo', '++++++', null,
      '2026-11-21', '2026-11-12',
      'seca', null, 'M1017|138kg Palpar'),

    -- 1009: Upgrade (handwritten, uncertain)
    (v_farm_id, v_cow_1009, '2026-06-05', 'Upgrade', 'monta_natural',
      'desconocido', 'Upgrade', null,
      null, '2026-12-12',
      'sin_servicio', null, 'Toro: Upgrade — pendiente confirmar'),

    -- Talla: Duroc terminal/Apaloosa, Seca
    (v_farm_id, v_cow_talla, '2026-05-12', 'Duroc terminal', 'monta_natural',
      'positivo', '++++++', null,
      '2026-11-12', '2026-11-12',
      'seca', null, 'M1015 | 252kg | Palpar'),

    -- Chavela: Apaloosa/bandido, OK
    (v_farm_id, v_cow_chavela, '2026-05-15', 'Apaloosa/bandido', 'monta_natural',
      'positivo', '++++++', null,
      null, null,
      'sin_servicio', null, 'OK');

end $$;
