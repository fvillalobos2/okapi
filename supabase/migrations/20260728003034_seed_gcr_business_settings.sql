-- seed_gcr_business_settings
--
-- Migrates GCR-specific messages that were previously hardcoded in agent.py
-- into the businesses.settings JSONB column so the generic engine can serve
-- any client with its own copy of these strings.
--
-- Only applies if the row exists and settings is still empty.

UPDATE businesses
SET settings = jsonb_build_object(
  'follow_up_message_es', '¡Hola! ¿Seguís interesado en rentar un carrito de golf en Costa Rica? 🏖️',
  'follow_up_message_en', 'Hey! Just checking in — still interested in renting a golf cart? 🏖️',
  'reset_message_es',     '¡Claro! Empezamos de nuevo. 🏖️ ¿En qué playa de Costa Rica necesitas el carrito de golf?',
  'reset_message_en',     'Sure, let''s start fresh! 🏖️ Which Costa Rica beach town do you need a golf cart in?',
  'payment_confirmation_es', E'✅ *¡Reserva Confirmada!*\n\nTu pago fue recibido y tu carrito de golf está asegurado. 🏖️\n\nEl proveedor local te contactará directamente para coordinar la entrega. Si tienes alguna pregunta, estamos aquí 24/7.\n\n_GolfCartRentalsCR — Tu ride en el paraíso_ 🌴',
  'payment_confirmation_en', E'✅ *Booking Confirmed!*\n\nYour payment has been received and your golf cart reservation is locked in. 🏖️\n\nThe local provider will contact you directly to coordinate pickup. If you have any questions, we''re here 24/7!\n\n_GolfCartRentalsCR — Your ride in paradise_ 🌴'
)
WHERE slug = 'golfcartrentalscr'
  AND settings = '{}'::jsonb;
