
ALTER TABLE public.wa_clients
  ADD COLUMN IF NOT EXISTS website          text,
  ADD COLUMN IF NOT EXISTS instagram        text,
  ADD COLUMN IF NOT EXISTS facebook         text,
  ADD COLUMN IF NOT EXISTS phone_display    text,
  ADD COLUMN IF NOT EXISTS email            text,
  ADD COLUMN IF NOT EXISTS address          text,
  ADD COLUMN IF NOT EXISTS city             text,
  ADD COLUMN IF NOT EXISTS country          text DEFAULT 'Costa Rica',
  ADD COLUMN IF NOT EXISTS business_hours   text,
  ADD COLUMN IF NOT EXISTS description      text,
  ADD COLUMN IF NOT EXISTS financing_info   text,
  ADD COLUMN IF NOT EXISTS warranty_info    text,
  ADD COLUMN IF NOT EXISTS service_area     text;

UPDATE public.wa_clients SET
  website        = 'https://innovahomecenter.com',
  instagram      = 'https://www.instagram.com/innova_homecenter/',
  facebook       = 'https://www.facebook.com/innovahomecenter',
  phone_display  = '+506 4000-1818',
  email          = 'servicioalcliente@grupoihc.com',
  city           = 'San José',
  country        = 'Costa Rica',
  service_area   = 'Todo Costa Rica (visita técnica gratuita en GAM)',
  description    = 'Empresa costarricense especializada en diseño de interiores y exteriores. Productos 100% a medida con instalación profesional incluida.',
  financing_info = 'Financiamiento disponible con CREDIX y opciones sin intereses',
  warranty_info  = 'Garantía de 1 año en todos los productos'
WHERE slug = 'innova';
;
