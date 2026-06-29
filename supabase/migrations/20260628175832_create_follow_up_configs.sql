
CREATE TABLE IF NOT EXISTS public.wa_follow_up_configs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid REFERENCES public.wa_clients(id) ON DELETE CASCADE,
  delay_hours  integer NOT NULL DEFAULT 24,
  message      text NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

-- Pre-fill Innova follow-up messages based on sales study
INSERT INTO public.wa_follow_up_configs (client_id, delay_hours, message, sort_order)
SELECT id, 2,
  'Hola, soy del equipo de Innova 👋 Vi que estuviste consultando sobre nuestros productos. ¿Pudiste revisar la información que te compartió nuestro asistente? Con gusto te coordino la visita técnica gratuita esta semana.',
  1
FROM public.wa_clients WHERE slug = 'innova';

INSERT INTO public.wa_follow_up_configs (client_id, delay_hours, message, sort_order)
SELECT id, 24,
  '¡Hola de nuevo! Te escribo desde Innova para darte seguimiento. ¿Tienes alguna duda sobre los productos o precios que te mencionamos? Podemos agendar una visita sin compromiso 🏠',
  2
FROM public.wa_clients WHERE slug = 'innova';

INSERT INTO public.wa_follow_up_configs (client_id, delay_hours, message, sort_order)
SELECT id, 72,
  'Hola, es nuestro último mensaje de seguimiento desde Innova. Si en algún momento necesitás cotizar persianas, cortinas, toldos, pisos o deck, aquí estamos. ¡Que tengas un excelente día! 😊',
  3
FROM public.wa_clients WHERE slug = 'innova';
;
