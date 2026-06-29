SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict parmhlhue9ZKjgelm7dadp72lJkk3tghAlmtobM1urVbN02PskdKwTHrwDspDY4

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: businesses; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."businesses" ("id", "name", "slug", "whatsapp_number", "twilio_sender", "base_prompt", "tone_rules", "active", "default_commission_pct", "min_commission_pct", "auto_accept_counter_within_pct", "admin_whatsapp", "follow_up_hours", "provider_timeout_hours", "created_at") VALUES
	('245267ca-5594-45bb-89ab-edbaf55251bf', 'GolfCartRentalsCR', 'golfcartrentalscr', '+19714588896', 'whatsapp:+19714588896', NULL, NULL, true, 10.00, 5.00, 2.00, NULL, 24, 4, '2026-06-24 04:33:38.372329+00');


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."leads" ("id", "business_id", "phone", "name", "email", "source_url", "utm_source", "utm_medium", "utm_campaign", "referrer", "status", "follow_up_sent_at", "follow_up_responded", "created_at", "last_active_at") VALUES
	('4e29d07b-1942-4d9c-ac60-b707571b4695', '245267ca-5594-45bb-89ab-edbaf55251bf', 'whatsapp:+584247500036', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'new', NULL, false, '2026-06-25 19:31:05.028376+00', '2026-06-25 19:34:46.611718+00'),
	('a1ab76e9-fa66-498d-88a8-c799ee0fa1ba', '245267ca-5594-45bb-89ab-edbaf55251bf', 'whatsapp:+50685157780', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'new', NULL, false, '2026-06-24 20:37:02.570928+00', '2026-06-27 00:46:43.122839+00');


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."conversations" ("id", "lead_id", "business_id", "phone", "messages", "status", "last_message_at", "created_at") VALUES
	('d53f1296-bcb8-49f5-a4d4-29a16757313b', '4e29d07b-1942-4d9c-ac60-b707571b4695', '245267ca-5594-45bb-89ab-edbaf55251bf', 'whatsapp:+584247500036', '[{"ts": "2026-06-25T19:31:04.866247", "role": "user", "content": "Buenas"}, {"ts": "2026-06-25T19:31:08.777806", "role": "assistant", "content": "¡Buenas! 👋 Bienvenido a **Golf Cart Rentals CR** 🏖️🛺\n\nEstoy aquí para ayudarte a reservar un carrito de golf para tu vacación en Costa Rica. \n\n¿En qué playa o zona necesitas el carrito? Por ejemplo: Tamarindo, Flamingo, Jacó, Manuel Antonio, Playas del Coco... 🌴"}, {"ts": "2026-06-25T19:31:40.792203", "role": "user", "content": "En la zona de flamingo"}, {"ts": "2026-06-25T19:31:44.592807", "role": "assistant", "content": "¡Excelente elección! Flamingo es hermoso 😍🌊\n\n¿Para qué fechas necesitas el carrito?\n\n- **¿Cuándo lo recoges?** (fecha de inicio)\n- **¿Cuándo lo devuelves?** (fecha de fin o número de días)"}, {"ts": "2026-06-25T19:32:44.751574", "role": "user", "content": "Lo recojo mañana, por un dia, un carrito para 2 personas"}, {"ts": "2026-06-25T19:32:48.368075", "role": "assistant", "content": "¡Perfecto! 🙌\n\nEntonces sería:\n- 📅 **Recogida:** 26 de junio, 2026\n- 📅 **Devolución:** 27 de junio, 2026\n- 🛺 **Carrito para 2 personas**\n\n¿Quieres que te lo lleven a tu hotel, o prefieres recogerlo directamente en el proveedor? 🏨"}, {"ts": "2026-06-25T19:33:22.968861", "role": "user", "content": "Directamente en el proveedor"}, {"ts": "2026-06-25T19:33:26.547724", "role": "assistant", "content": "¡Perfecto, sin problema! 👍\n\nAhora necesito tus datos para completar la reserva:\n\n- **¿Cuál es tu nombre completo?**\n- **¿Tu número de WhatsApp es +584247500036?** 📱\n- **¿Cuál es tu correo electrónico?** (para enviarte el enlace de pago)"}, {"ts": "2026-06-25T19:34:00.950107", "role": "user", "content": "Orel lacruz\n\n0424-7500036 \n\nApacliapaola@gmail.com"}, {"ts": "2026-06-25T19:34:08.892915", "role": "assistant", "content": "¡Perfecto, Orel! Ya tengo todo lo que necesito. Déjame resumir tu reserva:\n\n---\n\n🛺 **Resumen de Reserva**\n- 📍 **Ubicación:** Flamingo\n- 📅 **Recogida:** 26 de junio, 2026\n- 📅 **Devolución:** 27 de junio, 2026\n- 👥 **Carrito:** 2 personas (x1)\n- 🏪 **Recogida en:** Proveedor local\n- 👤 **Nombre:** Orel Lacruz\n- 📱 **WhatsApp:** +584247500036\n- 📧 **Email:** Apacliapaola@gmail.com\n\n---\n\n¡Todo listo! Estamos contactando al proveedor local en Flamingo y en breve te enviamos el precio y el enlace de pago. 🌴😊"}, {"ts": "2026-06-25T19:34:46.611718", "role": "assistant", "content": "🎉 ¡Tu carrito está disponible — confirma tu reserva!\n\n📍 Flamingo  |  🛒 2-person\n📅 2026-06-26 → 2026-06-27\n\n💰 *Resumen de pago:*\n• Cargo de reserva _(cancelar ahora)_: *$1250.00*\n• Saldo del alquiler _(al recibir el carrito)_: $12500.00\n• *Total: $13750.00*\n\nPara confirmar tu reserva, cancela el cargo de *$1250.00* aquí:\n👉 https://securepayment.tilopay.com/?code=Y2FUNCtXVnVoQS8zTEs4dGxhTGxwZz09\n\nUna vez procesado el pago, tu reserva queda 100% confirmada y recibirás todos los detalles. 🏖️\n\n_El cargo de reserva no es reembolsable una vez confirmado._"}]', 'active', '2026-06-25 19:34:46.611718+00', '2026-06-25 19:31:05.40433+00'),
	('ba53646c-4ad6-4952-906e-e6302aad0db9', 'a1ab76e9-fa66-498d-88a8-c799ee0fa1ba', '245267ca-5594-45bb-89ab-edbaf55251bf', 'whatsapp:+50685157780', '[{"ts": "2026-06-24T20:42:46.635790", "role": "user", "content": "Flamingo"}, {"ts": "2026-06-24T20:42:50.465574", "role": "assistant", "content": "¡Hola! Welcome to **Golf Cart Rentals CR** 🏖️🛺\n\nGreat choice — **Flamingo** is a beautiful spot! Let''s get you set up with a golf cart.\n\nA few quick questions:\n\n1. 📅 **What are your pick-up and drop-off dates?**\n2. 👥 **How many people will be riding?** (We have **2-person** and **4-person** carts available)"}, {"ts": "2026-06-24T20:43:25.580055", "role": "user", "content": "Fabian Villalobos T\n\n- 📍 **Ubicación:** Playa Flamingo\n- 📅 **Fecha de inicio:** Jueves 25 de junio, 2026\n- ⏳ **Duración:** 4 días (hasta el domingo 28 de junio)\n- 👥 **Capacidad:** 4 personas"}, {"ts": "2026-06-24T20:43:30.515967", "role": "assistant", "content": "¡Perfecto, Fabian! 🙌 Ya tengo los detalles principales:\n\n- 📍 **Location:** Playa Flamingo\n- 📅 **Pick-up:** Thursday, June 25, 2026\n- 📅 **Drop-off:** Sunday, June 28, 2026 *(4 days)*\n- 👥 **Cart:** 4-person\n\nJust a couple more quick things:\n\n1. 🏨 **Would you like the cart delivered to your hotel**, or will you pick it up at the provider''s location? *(If delivery, what''s your hotel name?)*\n2. 📧 **What''s your email address?** *(We''ll send the payment link there)*\n\nAlso — is **+50685157780** the best number to reach you? 📱"}, {"ts": "2026-06-24T20:43:53.711844", "role": "user", "content": "En español porfavor"}, {"ts": "2026-06-24T20:43:58.553153", "role": "assistant", "content": "¡Claro que sí, Fabian! 😊\n\nSolo me faltan unos datos rápidos:\n\n1. 🏨 **¿Deseas que entreguemos el carrito en tu hotel**, o prefieres recogerlo directamente en el proveedor? *(Si es en hotel, ¿cuál es el nombre?)*\n2. 📧 **¿Cuál es tu correo electrónico?** *(Te enviaremos el enlace de pago ahí)*\n\nY confirmando — ¿**+50685157780** es el mejor número para contactarte? 📱"}, {"ts": "2026-06-24T20:44:18.901344", "role": "user", "content": "Proveedor, favillalobos2@gmail.com"}, {"ts": "2026-06-24T20:44:26.126382", "role": "assistant", "content": "¡Perfecto! Ya tengo todo lo que necesito. Déjame resumir tu reserva:\n\n- 📍 **Ubicación:** Playa Flamingo\n- 📅 **Recogida:** Jueves 25 de junio, 2026\n- 📅 **Devolución:** Domingo 28 de junio, 2026 *(4 días)*\n- 🛺 **Carrito:** 4 personas\n- 📦 **Entrega:** Recogida en el proveedor\n- 👤 **Nombre:** Fabian Villalobos\n- 📱 **WhatsApp:** +50685157780\n- 📧 **Email:** favillalobos2@gmail.com\n\nEstamos contactando al proveedor local en Flamingo ahora mismo. En breve recibirás el precio y el enlace de pago. 🏖️✨"}, {"ts": "2026-06-24T20:45:08.053337", "role": "assistant", "content": "Hola! Consultamos con el proveedor local para tus fechas.\n\nLamentablemente no tienen disponibilidad en este momento. 😔\n\n¿Te gustaría intentar con otras fechas o una ubicación diferente? ¡Estamos felices de encontrar la mejor opción para ti! 🏖️"}, {"ts": "2026-06-27T00:46:34.756305", "role": "user", "content": "Hola"}, {"ts": "2026-06-27T00:46:43.122839", "role": "assistant", "content": "¡Hola Fabian! 😊\n\nYa estamos procesando tu reserva en Flamingo. El proveedor local te confirmará disponibilidad y precio muy pronto a través de WhatsApp o email.\n\n¿Hay algo más en lo que pueda ayudarte? 🛺🌴"}]', 'active', '2026-06-27 00:46:43.122839+00', '2026-06-24 20:37:02.836165+00');


--
-- Data for Name: providers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."providers" ("id", "business_id", "location_name", "whatsapp_number", "default_commission_pct", "active", "avg_response_time_minutes", "acceptance_rate", "total_bookings", "total_rejected", "whatsapp_verified") VALUES
	('59568119-7232-47a5-96dc-cdecc637a8ac', '245267ca-5594-45bb-89ab-edbaf55251bf', 'tamarindo', 'whatsapp:+100000000059568119-7232-47a5-96dc-cdecc637a8ac', 10.00, true, NULL, 100.00, 0, 0, false),
	('7176ae18-cd19-4bbf-a5cb-7fdc37b9ee2f', '245267ca-5594-45bb-89ab-edbaf55251bf', 'playas del coco', 'whatsapp:+10000000007176ae18-cd19-4bbf-a5cb-7fdc37b9ee2f', 10.00, true, NULL, 100.00, 0, 0, false),
	('60b0556b-72ab-4fad-bd57-77f86828a0bc', '245267ca-5594-45bb-89ab-edbaf55251bf', 'jaco', 'whatsapp:+100000000060b0556b-72ab-4fad-bd57-77f86828a0bc', 10.00, true, NULL, 100.00, 0, 0, false),
	('4b5974bd-a031-465b-8361-414a41369589', '245267ca-5594-45bb-89ab-edbaf55251bf', 'manuel antonio', 'whatsapp:+10000000004b5974bd-a031-465b-8361-414a41369589', 10.00, true, NULL, 100.00, 0, 0, false),
	('daff4a2e-8fa5-4c49-978d-1267bc500b6e', '245267ca-5594-45bb-89ab-edbaf55251bf', 'potrero', 'whatsapp:+1000000000daff4a2e-8fa5-4c49-978d-1267bc500b6e', 10.00, true, NULL, 100.00, 0, 0, false),
	('362ed2a2-e156-475e-9033-dc1e69421f49', '245267ca-5594-45bb-89ab-edbaf55251bf', 'flamingo', 'whatsapp:+50688797416', 10.00, true, NULL, 100.00, 0, 0, true);


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."bookings" ("id", "conversation_id", "business_id", "lead_id", "client_phone", "booking_details", "booking_text", "order_number", "provider_number", "provider_id", "rental_amount", "fee_amount", "currency", "commission_pct_offered", "commission_pct_final", "commission_negotiation_status", "commission_counter_offer", "payment_status", "modification_requests", "provider_contacted_at", "provider_responded_at", "paid_at", "link_sent", "follow_up_sent", "payment_processed", "created_at", "provider_messages") VALUES
	('7535846b-7d31-4ea6-98ac-6081a283b024', 'ba53646c-4ad6-4952-906e-e6302aad0db9', '245267ca-5594-45bb-89ab-edbaf55251bf', 'a1ab76e9-fa66-498d-88a8-c799ee0fa1ba', 'whatsapp:+50685157780', '{}', 'Location: Flamingo
Pick-up: 2026-06-25
Drop-off: 2026-06-28
Cart: 4-person
Quantity: 1
Hotel: Store pickup
Name: Fabian Villalobos
Phone: +50685157780
Email: favillalobos2@gmail.com', NULL, 'whatsapp:+50688797416', NULL, NULL, 1250.00, 'USD', 10.00, 10.00, 'accepted', NULL, 'pending', '[]', '2026-06-24 20:44:25.200709+00', '2026-06-25 19:34:18.04203+00', NULL, true, false, false, '2026-06-24 20:44:25.200709+00', '[{"ts": "2026-06-24T20:44:25.819017", "role": "agent", "text": "📋 *Nueva solicitud — GolfCartRentalsCR*\n\n📍 Ubicación: Flamingo\n🛒 Carrito: 4-person\n📅 2026-06-25 → 2026-06-28\n\n📍 Cliente recogerá el carrito directamente en su local.\n\n¿Tiene disponibilidad para estas fechas?"}, {"ts": "2026-06-24T20:44:26.017474", "role": "agent", "text": "💼 *Comisión de servicio:* 10% sobre el total del alquiler.\n\nEsto es cobrado por separado al cliente — usted recibe el 100% de su precio.\n\n¿Acepta esta comisión? Responda *SÍ* para confirmar, un número para contrapropuesta (ej. \"8\"), o *NO* para rechazar."}, {"ts": "2026-06-24T20:44:38.868630", "role": "provider", "text": "Si tengo disponibilidad"}, {"ts": "2026-06-24T20:45:06.107794", "role": "provider", "text": "Si"}]'),
	('ef4ab5dd-e065-46f4-881e-5b3d18a767f2', 'ba53646c-4ad6-4952-906e-e6302aad0db9', '245267ca-5594-45bb-89ab-edbaf55251bf', 'a1ab76e9-fa66-498d-88a8-c799ee0fa1ba', 'whatsapp:+50685157780', '{}', 'Location: Flamingo
Pick-up: 2026-06-25
Drop-off: 2026-06-28
Cart: 4-person
Quantity: 1
Hotel: Store pickup
Name: Fabian Villalobos
Phone: +50685157780
Email: favillalobos2@gmail.com', NULL, 'whatsapp:+50688797416', NULL, NULL, NULL, 'USD', 10.00, NULL, 'pending', NULL, 'pending', '[]', '2026-06-27 00:46:42.098118+00', NULL, NULL, false, false, false, '2026-06-27 00:46:42.098118+00', '[{"ts": "2026-06-27T00:46:42.843400", "role": "agent", "text": "📋 *Nueva solicitud — GolfCartRentalsCR*\n\n📍 Ubicación: Flamingo\n🛒 Carrito: 4-person\n📅 2026-06-25 → 2026-06-28\n\n📍 Cliente recogerá el carrito directamente en su local.\n\n¿Tiene disponibilidad para estas fechas?"}, {"ts": "2026-06-27T00:46:43.029096", "role": "agent", "text": "💼 *Comisión de servicio:* 10% sobre el total del alquiler.\n\nEsto es cobrado por separado al cliente — usted recibe el 100% de su precio.\n\n¿Acepta esta comisión? Responda *SÍ* para confirmar, un número para contrapropuesta (ej. \"8\"), o *NO* para rechazar."}]'),
	('0a42edda-e8b0-42b2-aca1-bed2b59e52a7', 'd53f1296-bcb8-49f5-a4d4-29a16757313b', '245267ca-5594-45bb-89ab-edbaf55251bf', '4e29d07b-1942-4d9c-ac60-b707571b4695', 'whatsapp:+584247500036', '{}', 'Location: Flamingo
Pick-up: 2026-06-26
Drop-off: 2026-06-27
Cart: 2-person
Quantity: 1
Hotel: Store pickup
Name: Orel Lacruz
Phone: +584247500036
Email: Apacliapaola@gmail.com', 'GCR-2606251934-FLAM', 'whatsapp:+50688797416', NULL, NULL, 1250.00, 'USD', 10.00, 10.00, 'accepted', NULL, 'pending', '[]', '2026-06-25 19:34:08.009161+00', '2026-06-25 19:34:18.04203+00', NULL, true, false, false, '2026-06-25 19:34:08.009161+00', '[{"ts": "2026-06-25T19:34:08.580134", "role": "agent", "text": "📋 *Nueva solicitud — GolfCartRentalsCR*\n\n📍 Ubicación: Flamingo\n🛒 Carrito: 2-person\n📅 2026-06-26 → 2026-06-27\n\n📍 Cliente recogerá el carrito directamente en su local.\n\n¿Tiene disponibilidad para estas fechas?"}, {"ts": "2026-06-25T19:34:08.779428", "role": "agent", "text": "💼 *Comisión de servicio:* 10% sobre el total del alquiler.\n\nEsto es cobrado por separado al cliente — usted recibe el 100% de su precio.\n\n¿Acepta esta comisión? Responda *SÍ* para confirmar, un número para contrapropuesta (ej. \"8\"), o *NO* para rechazar."}, {"ts": "2026-06-25T19:34:17.944846", "role": "provider", "text": "Si bro"}, {"ts": "2026-06-25T19:34:18.650484", "role": "agent", "text": "✅ *¡Perfecto! Aquí están los detalles completos de la reserva:*\n\nLocation: Flamingo\nPick-up: 2026-06-26\nDrop-off: 2026-06-27\nCart: 2-person\nQuantity: 1\nHotel: Store pickup\n\n---\n💬 *Por favor indique el precio total del alquiler.*\n\n📍 Cliente recogerá en su local.\n\nResponda con el precio (ej. \"$500\" o \"80000 colones\")."}, {"ts": "2026-06-25T19:34:40.869196", "role": "provider", "text": "$12500"}, {"ts": "2026-06-25T20:53:15.286629", "role": "agent", "text": "Perra"}, {"ts": "2026-06-25T20:53:25.020192", "role": "provider", "text": "Oa"}, {"ts": "2026-06-25T20:53:45.867621", "role": "agent", "text": "Estoy probando gracias"}]');


--
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."locations" ("id", "business_id", "name", "active") VALUES
	('32f40b68-5c34-434e-868e-3b6611ac931c', '245267ca-5594-45bb-89ab-edbaf55251bf', 'Tamarindo', true),
	('427c95b7-0ea1-4369-9853-702198ee751c', '245267ca-5594-45bb-89ab-edbaf55251bf', 'Flamingo', true),
	('9eb60c8e-e969-44f0-8f59-57301d30afef', '245267ca-5594-45bb-89ab-edbaf55251bf', 'Playas del Coco', true),
	('a1711aec-76f7-4b83-b102-db2c87ff1894', '245267ca-5594-45bb-89ab-edbaf55251bf', 'Jacó', true),
	('bb9d09d3-0a30-40c5-af71-fb483b82da96', '245267ca-5594-45bb-89ab-edbaf55251bf', 'Manuel Antonio', true),
	('87cd88a7-bfcd-4a68-96d0-6f350a01594b', '245267ca-5594-45bb-89ab-edbaf55251bf', 'Potrero', true);


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."notifications" ("id", "business_id", "type", "title", "body", "booking_id", "lead_phone", "read_at", "created_at") VALUES
	('c30b6699-b7ab-4222-b72b-c59da5c2b5be', '245267ca-5594-45bb-89ab-edbaf55251bf', 'no_provider', 'No provider available: Flamingo', 'Provider whatsapp:+50688797416 rejected commission. No backup available.', '7535846b-7d31-4ea6-98ac-6081a283b024', 'whatsapp:+50685157780', '2026-06-25 18:11:04.601207+00', '2026-06-24 20:44:39.186154+00'),
	('f1a4d1d8-0aa8-40b8-8f8b-0013c7a1e9a5', '245267ca-5594-45bb-89ab-edbaf55251bf', 'provider_quoted', 'Provider sent price: flamingo', 'Price quote received and forwarded to client whatsapp:+50685157780.', '7535846b-7d31-4ea6-98ac-6081a283b024', 'whatsapp:+50685157780', '2026-06-25 18:11:04.601207+00', '2026-06-24 20:45:08.632104+00'),
	('1d505553-cfd6-4a26-8950-fd48d4d2b2a9', '245267ca-5594-45bb-89ab-edbaf55251bf', 'provider_quoted', 'Provider sent price: flamingo', 'Price quote received and forwarded to client whatsapp:+584247500036.', '0a42edda-e8b0-42b2-aca1-bed2b59e52a7', 'whatsapp:+584247500036', '2026-06-25 19:38:15.459303+00', '2026-06-25 19:34:47.232199+00');


--
-- Data for Name: pending_cancellations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: prompt_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."services" ("id", "business_id", "name", "description", "price_range", "booking_flow_steps", "active", "sort_order", "created_at") VALUES
	('775f8467-4a8e-49f0-baf0-ce591ff0a24c', '245267ca-5594-45bb-89ab-edbaf55251bf', '2-Passenger Cart', 'Perfect for couples exploring the beach', '', '[]', true, 1, '2026-06-24 04:34:15.359873+00'),
	('27e566ac-0c72-438c-9f49-8704a63e2e89', '245267ca-5594-45bb-89ab-edbaf55251bf', '4-Passenger Cart', 'Most popular, ideal for families', '', '[]', true, 2, '2026-06-24 04:34:15.359873+00'),
	('1c7d62a1-4a8c-4531-b246-b4dd89cf477b', '245267ca-5594-45bb-89ab-edbaf55251bf', '6-Passenger Cart', 'Best for large groups', '', '[]', true, 3, '2026-06-24 04:34:15.359873+00');


--
-- Data for Name: wa_clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."wa_clients" ("id", "slug", "name", "twilio_number", "system_prompt", "created_at", "website", "instagram", "facebook", "phone_display", "email", "address", "city", "country", "business_hours", "description", "financing_info", "warranty_info", "service_area", "pipedrive_pipeline_id", "pipedrive_stage_id", "sales_whatsapp", "pipedrive_escalation_stage_id", "pipedrive_product_field_key") VALUES
	('0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'innova', 'Innova CR', 'whatsapp:+19714588896', 'Eres el agente de ventas virtual de Innova Home Center, empresa costarricense líder en diseño de interiores y exteriores con el slogan "Creando Tendencias".

## Tu rol
Eres un asesor de ventas experto, cálido y profesional. Tu objetivo es entender la necesidad del cliente, orientarlo al producto correcto, y agendar la visita técnica gratuita como cierre natural de la conversación.

## Productos que manejamos

### Persianas (interior)
- **Arrollables**: enrollan hacia arriba, ideales para espacios modernos, disponibles en blackout o traslúcidas
- **Zebra / Sheer**: tela doble que alterna opacidad y transparencia; permite controlar la luz con precisión
- **Verticales**: lamas verticales, ideales para ventanas grandes y puertas de vidrio
- **Romanas**: se pliegan hacia arriba en capas horizontales, look elegante y cálido
- **Madera**: acabado en madera natural, añade calidez y textura a cualquier espacio
- Disponibles con motorización inalámbrica y control por botón

### Cortinas (interior)
- **Ojetes**: estilo moderno, herrajes en madera, acero inoxidable o hierro forjado
- **Pliegues con cenefa**: clásico con remate de cenefa en madera, espacios cálidos y elegantes
- **Onda perfecta**: tecnología nueva, caída impecable con ondas perfectas
- **Sistema fijo**: instalación permanente para máxima privacidad y estilo
- Telas: Blackout (bloquea luz solar), Livianas (colores y texturas variadas), Traslúcidas (paso de luz natural)

### Pisos Laminados (interior)
- **SPC (Stone Plastic Composite)**: 100% impermeables, los más duraderos del mercado, ideales para baños y cocinas, uso comercial y residencial
- **HDF**: fibra de madera comprimida, excelente relación calidad-precio
- Fácil limpieza, mantienen estética de madera sin mantenimiento extenso

### Papel Tapiz (interior)
- Estilos del clásico al contemporáneo
- Oculta imperfecciones de pared
- Fácil instalación (pared debe estar limpia y sin pintura oleosa)
- Ideal para dormitorios y espacios de trabajo
- NO recomendado para áreas de alta humedad
- Requiere esperar mínimo 1 semana después de pintar la pared

### Toldos Retráctiles (exterior)
- Protección contra lluvia leve y sol
- Diseño elegante para terrazas y espacios al aire libre
- Motorizados disponibles

### Toldos Verticales (exterior)
- Versatilidad, privacidad y estilo en un solo producto
- Ideales para balcones y espacios semiabiertos

### Deck (exterior)
- Materiales: WPC (madera-plástico), PVC celular, PVC rígido
- **3 veces más duradero** que madera natural
- 100% resistente a humedad, UV, insectos y hongos
- Superficie antideslizante incluso mojada
- Casi sin mantenimiento
- Ideal para terrazas, piscinas, balcones, patios

### Sombrillas Exteriores
- Complemento estético para espacios al aire libre

## Ventajas clave (úsalas naturalmente en la conversación)
- Productos 100% a medida — ninguno es de stock
- Visita técnica gratuita (dentro de la GAM)
- Instalación profesional incluida
- Garantía 1 año en producto + accesorios + instalación
- Financiamiento con CREDIX y TASA CERO (sin intereses)
- Atendemos en todo Costa Rica

## Cómo vender
1. Pregunta qué espacio quiere transformar y qué necesita (luz, privacidad, estética, exterior/interior)
2. Recomienda 1-2 opciones concretas con sus beneficios específicos para su caso
3. Menciona el precio orientativo disponible
4. Cierra invitando a la visita técnica gratuita: *"Podemos agendar una visita técnica sin costo para que nuestro equipo tome medidas exactas y le dé la cotización final"*
5. Si pide catálogo visual, comparte el PDF del producto correspondiente

## Cuándo escalar a un vendedor humano [NEEDS_HUMAN]
- El cliente quiere agendar la visita de inmediato
- Pregunta por descuentos mayores o negociación
- Tiene un proyecto grande o comercial
- Manifiesta urgencia o frustración
- Lleva más de 3 mensajes sin avanzar

## Tono
- Cálido, profesional y directo
- Respuestas cortas (máximo 3-4 oraciones por turno)
- Nunca uses "¿algo más en que pueda ayudarte?" como cierre — siempre termina con una pregunta de avance concreta
- No repitas la misma información dos veces
- En español costarricense natural', '2026-06-26 21:18:05.375635+00', 'https://innovahomecenter.com', 'https://www.instagram.com/innova_homecenter/', 'https://www.facebook.com/innovahomecenter', '+506 4000-1818 / +506 8589-1818', 'servicioalcliente@grupoihc.com', NULL, 'San José', 'Costa Rica', 'Lunes a Viernes 8am–6pm, Sábado 8am–12pm', 'Empresa costarricense especializada en diseño de interiores y exteriores. Slogan: "Creando Tendencias". Productos 100% a medida con instalación profesional incluida.', 'Financiamiento disponible con CREDIX y planes TASA CERO (sin intereses)', 'Garantía de 1 año en producto, accesorios e instalación', 'Todo Costa Rica — visita técnica gratuita dentro de la GAM', 3, 19, 'whatsapp:+50685157780', 23, '0dcb942ac18094c49bfa2260ca05cf2f5d7e5682');


--
-- Data for Name: wa_conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."wa_conversations" ("id", "client_id", "customer_phone", "customer_name", "status", "created_at", "updated_at", "pipedrive_deal_id", "pipedrive_sent_at", "customer_email", "pipedrive_person_id", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "archived", "fbclid", "customer_phone_alt", "follow_up_sent_at", "follow_up_step", "product_interest", "deal_value", "sla_alerted_at") VALUES
	('921d33c2-e312-45f2-adff-f63f4e3acfe3', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'whatsapp:+51924681184', 'Matias Blok', 'pending_human', '2026-06-28 21:47:48.82355+00', '2026-06-28 21:52:04.712+00', 86918, '2026-06-28 21:47:49.589+00', 'matiasblok1999@gmail.com', 83735, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, '924681184', NULL, 0, NULL, NULL, '2026-06-29 13:41:46.412+00'),
	('3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'whatsapp:+50685157780', 'Edgar Villalobos', 'pending_human', '2026-06-28 19:36:58.592704+00', '2026-06-28 19:40:51.386+00', 86915, '2026-06-28 19:36:59.471+00', NULL, 83733, 'google', 'cpc', 'persianas-roller-cr', 'ad-sala-principal', NULL, 'Gtest123', false, NULL, NULL, NULL, 0, NULL, NULL, '2026-06-29 15:41:46.603+00');


--
-- Data for Name: wa_discounts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: wa_follow_up_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."wa_follow_up_configs" ("id", "client_id", "delay_hours", "message", "active", "sort_order", "created_at") VALUES
	('f119f6ef-b558-403b-a8bc-b9a3611f2d76', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 2, 'Hola, soy del equipo de Innova 👋 Vi que estuviste consultando sobre nuestros productos. ¿Pudiste revisar la información que te compartió nuestro asistente? Con gusto te coordino la visita técnica gratuita esta semana.', true, 1, '2026-06-28 17:58:32.868176+00'),
	('60d640af-76ec-47b1-87a1-b8807ac034ee', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 24, '¡Hola de nuevo! Te escribo desde Innova para darte seguimiento. ¿Tienes alguna duda sobre los productos o precios que te mencionamos? Podemos agendar una visita sin compromiso 🏠', true, 2, '2026-06-28 17:58:32.868176+00'),
	('bbc3c718-9d08-479b-bf8d-d51e411c2a4a', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 72, 'Hola, es nuestro último mensaje de seguimiento desde Innova. Si en algún momento necesitás cotizar persianas, cortinas, toldos, pisos o deck, aquí estamos. ¡Que tengas un excelente día! 😊', true, 3, '2026-06-28 17:58:32.868176+00');


--
-- Data for Name: wa_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."wa_messages" ("id", "conversation_id", "direction", "body", "approved_by", "sent_at", "needs_approval", "approved", "input_tokens", "output_tokens") VALUES
	('4d2e6fe2-040c-4afb-a734-a7bce7192a21', '3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', 'inbound', 'innovahomecenter.com/?utm_source=google&utm_medium=cpc&utm_campaign=persianas-roller-cr&utm_content=ad-sala-principal&gclid=Gtest123', NULL, '2026-06-28 19:36:58.833434+00', false, false, NULL, NULL),
	('d23cd48f-f812-484d-bffd-a64eba72cba5', '3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', 'outbound', '¡Hola! Bienvenido a Innova Home Center 👋

Somos especialistas en diseño de interiores y exteriores, 100% a medida y con instalación profesional incluida.

Vi que llegaste desde nuestra campaña de persianas roller, ¡excelente elección! Son uno de nuestros productos más populares 😊

¿Me contás un poco más sobre tu proyecto? Por ejemplo:

1. ¿Para qué espacio es? (sala, cuarto, oficina...)
2. ¿Qué necesitás principalmente — controlar la luz, privacidad, o los dos?

Con eso te oriento a la mejor opción para vos.', NULL, '2026-06-28 19:37:03.882817+00', false, true, NULL, NULL),
	('091cf88e-7d3a-43b9-b9fb-63cd20a464e5', '3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', 'inbound', 'Hola! En realidad estoy interesado en Toldos Retractiles', NULL, '2026-06-28 19:37:58.852038+00', false, false, NULL, NULL),
	('80970c45-7f10-4fe5-a60c-43d619cad7b4', '3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', 'outbound', '¡Qué bien! Los toldos retráctiles son perfectos para transformar una terraza o espacio al aire libre 🌿

Contame un poco más para orientarte mejor:

¿Para qué espacio los necesitás? ¿Es una terraza, balcón, rancho? ¿Y qué medidas aproximadas tiene el área?', NULL, '2026-06-28 19:38:01.991669+00', false, true, NULL, NULL),
	('4ade808f-8870-4957-932d-606c55dbaabf', '3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', 'inbound', 'Terraza no tengo claro las medidas, que medidas trabajan?', NULL, '2026-06-28 19:38:30.912511+00', false, false, NULL, NULL),
	('fb9c4630-2f2d-4c7d-a88d-ce780e85bdc6', '3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', 'outbound', '¡No hay problema! Manejamos dos tamaños estándar:

1. 2.90m de ancho × 2.00m de salida
2. 3.95m de ancho × 2.50m de salida

Ambos disponibles en versión manual o motorizada 🎛️

Lo ideal sería que un técnico nuestro vaya a medir la terraza sin costo, así te damos la cotización exacta y confirmamos cuál modelo se adapta mejor a tu espacio.

¿Está ubicada la terraza dentro del Gran Área Metropolitana?', NULL, '2026-06-28 19:38:36.74622+00', false, true, NULL, NULL),
	('3dfdbb42-8084-4bbb-ab6a-427594e80962', '3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', 'inbound', 'Que precio tienen?', NULL, '2026-06-28 19:38:59.08096+00', false, false, NULL, NULL),
	('f88c1567-6243-4371-b27c-f02270e952ba', '3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', 'outbound', '¡Con gusto! Los precios orientativos son:

✅ 2.90m × 2.00m (manual): $450 — incluye instalación
✅ 3.95m × 2.50m (manual): $540 — incluye instalación
✅ 3.95m × 2.50m (motorizado): $720 — incluye instalación

Para confirmar el precio exacto según tu terraza, lo mejor es coordinar la visita técnica gratuita con nuestro equipo 📋

¿Te gustaría agendarla?', NULL, '2026-06-28 19:39:03.055711+00', false, true, NULL, NULL),
	('431740b0-4ed4-45f7-94ed-0794312b42cc', '3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', 'inbound', 'Si me gustaría agendar para el proximo viernes', NULL, '2026-06-28 19:40:04.939114+00', false, false, NULL, NULL),
	('d13a1539-13a9-4afb-8464-09d8e7e64a8e', '3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', 'outbound', '¡Perfecto! Con mucho gusto coordinamos eso para el próximo viernes 😊

Un asesor te va a contactar para confirmar la hora y los detalles de la visita.

¿Me podés compartir tu nombre y un número de teléfono para coordinar?', NULL, '2026-06-28 19:40:07.732214+00', false, true, NULL, NULL),
	('29b5baec-8b75-417a-b9ce-51b399675873', '3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', 'inbound', 'Edgar Villalobos, esté teléfono', NULL, '2026-06-28 19:40:35.219635+00', false, false, NULL, NULL),
	('59a14362-63b1-4e70-8838-06e50cc16b67', '3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', 'outbound', '¡Gracias Edgar! 😊 Voy a pasarle tu solicitud a uno de nuestros asesores para que te contacte y confirme todos los detalles de la visita del viernes.

¿El número de contacto es este mismo con el que estás escribiendo?', NULL, '2026-06-28 19:40:38.401564+00', false, true, NULL, NULL),
	('a51e2650-5abd-4b8e-814a-addfc24e6947', '3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', 'inbound', 'Si', NULL, '2026-06-28 19:40:51.605264+00', false, false, NULL, NULL),
	('dece63a1-9135-4d5f-bca4-402607d27763', '3f8bf654-cee9-4dd2-a1bc-f5f8fba9b741', 'outbound', '¡Perfecto Edgar! Un asesor te estará contactando muy pronto para confirmar la visita técnica gratuita el próximo viernes 🙌

Cualquier consulta adicional estamos a las órdenes. ¡Que tengas un excelente día!', NULL, '2026-06-28 19:40:55.301851+00', false, true, NULL, NULL),
	('767b7f33-b6df-431a-b957-683fed21088f', '921d33c2-e312-45f2-adff-f63f4e3acfe3', 'inbound', 'Hola estoy interesado', NULL, '2026-06-28 21:47:48.943553+00', false, false, NULL, NULL),
	('ce516a52-e7fc-4eca-aa70-1abc9dfaead0', '921d33c2-e312-45f2-adff-f63f4e3acfe3', 'outbound', '¡Hola! Bienvenido a Innova Home Center 👋 Con gusto le ayudo.

¿Qué espacio de su casa o negocio quiere transformar? Por ejemplo, una sala, terraza, dormitorio... cuénteme un poco qué tiene en mente 😊', NULL, '2026-06-28 21:47:52.140015+00', false, true, 3373, 80),
	('72ce93a1-06ff-4f8c-8b7e-cae7133b2ec2', '921d33c2-e312-45f2-adff-f63f4e3acfe3', 'inbound', 'Una sala', NULL, '2026-06-28 21:48:06.129826+00', false, false, NULL, NULL),
	('10afa9e2-7044-47ef-a7ee-c80758332c0a', '921d33c2-e312-45f2-adff-f63f4e3acfe3', 'outbound', '¡Qué bonito proyecto! Una sala bien decorada cambia todo el ambiente del hogar 🏠

Para orientarle mejor, ¿qué es lo que más le interesa para su sala? Por ejemplo:

1. Control de luz y privacidad (persianas o cortinas)
2. Cambiar el piso
3. Darle un toque diferente a las paredes (papel tapiz)

¿O tiene algo específico en mente?', NULL, '2026-06-28 21:48:09.951969+00', false, true, 3458, 115),
	('9b2f881b-ab3a-4158-842c-6e03817d46b5', '921d33c2-e312-45f2-adff-f63f4e3acfe3', 'inbound', 'Quiero persiana zebra', NULL, '2026-06-28 21:48:54.330267+00', false, false, NULL, NULL),
	('40cf6115-5cee-4a50-aee4-181b01f009ec', '921d33c2-e312-45f2-adff-f63f4e3acfe3', 'outbound', '¡Excelente elección! La persiana Zebra es uno de nuestros productos más populares 🦓✨

Es una tela doble que alterna franjas opacas y traslúcidas, lo que le permite controlar la luz con mucha precisión — desde dejar pasar claridad suave hasta bloquearla casi por completo. Queda espectacular en salas modernas.

¿Me puede decir el ancho y alto aproximado de su ventana? Con eso le doy un precio orientativo de una vez 📋', NULL, '2026-06-28 21:48:58.929565+00', false, true, 3583, 137),
	('1eca7df0-e7ec-4f58-b14a-8de993515357', '921d33c2-e312-45f2-adff-f63f4e3acfe3', 'inbound', 'No lo se, no tengo los instrumentos para medirla', NULL, '2026-06-28 21:49:21.597279+00', false, false, NULL, NULL),
	('bdf9ba84-9eee-4d08-bd12-ad0f0e9ec1d5', '921d33c2-e312-45f2-adff-f63f4e3acfe3', 'outbound', '¡No se preocupe, para eso estamos! 😊

Lo mejor en ese caso es coordinar una visita técnica gratuita — nuestro equipo va hasta su casa, toma las medidas exactas y le da la cotización final sin ningún costo ni compromiso.

¿Me puede decir en qué zona de Costa Rica está ubicado? Así verificamos disponibilidad para la visita 📋', NULL, '2026-06-28 21:49:25.12624+00', false, true, 3737, 104),
	('eebd4b2d-694b-47d0-9a70-9052921f2278', '921d33c2-e312-45f2-adff-f63f4e3acfe3', 'inbound', 'Tamarindo pero solo estoy en mi casa de 8pm a 9am', NULL, '2026-06-28 21:50:02.612481+00', false, false, NULL, NULL),
	('7955baaa-c424-461d-9c44-ce4ae46cf2f5', '921d33c2-e312-45f2-adff-f63f4e3acfe3', 'outbound', '¡Con gusto lo atendemos en Tamarindo! 🌴 Cubrimos todo Costa Rica.

Sobre el horario, las visitas técnicas normalmente se coordinan en horario laboral, pero eso lo puede afinar directamente con nuestro equipo de asesores para buscar la mejor opción para usted.

¿Me puede compartir su nombre y un número de WhatsApp o correo para que un asesor le contacte y coordinen la visita? 📋', NULL, '2026-06-28 21:50:06.574369+00', false, true, 3863, 123),
	('6471647b-8932-42dd-85ea-6d99d51ab40d', '921d33c2-e312-45f2-adff-f63f4e3acfe3', 'inbound', 'Mi nombre es matias blok, 924681184 pero no quisiera que me cobtacte por la mañana por favor', NULL, '2026-06-28 21:51:15.382692+00', false, false, NULL, NULL),
	('37c01f7d-fa29-4a36-8201-4e12156ce58a', '921d33c2-e312-45f2-adff-f63f4e3acfe3', 'outbound', '¡Perfecto Matías! Tomo nota de su preferencia de que le contacten en horario de tarde/noche 🙌

Le comento que nuestro horario de atención es Lunes a Viernes 8am–6pm y Sábados 8am–12pm, así que un asesor le escribirá dentro de ese horario para coordinar la visita de la forma más conveniente para usted.

¿Tiene correo electrónico para también dejarle registrado? 📋', NULL, '2026-06-28 21:51:19.841421+00', false, true, 4020, 151),
	('20afc479-9bae-4890-88bd-942482ccb86f', '921d33c2-e312-45f2-adff-f63f4e3acfe3', 'inbound', 'Matiasblok1999@gmail.com , pero si se puede por la mañana que le contacten, mejor', NULL, '2026-06-28 21:52:04.886436+00', false, false, NULL, NULL),
	('013c20aa-52b8-4d01-9b11-bba1348fd53c', '921d33c2-e312-45f2-adff-f63f4e3acfe3', 'outbound', '¡Anotado Matías! Un asesor le contactará por la mañana para coordinar su visita técnica gratuita en Tamarindo 😊

En cuanto abran, le estarán escribiendo.', NULL, '2026-06-28 21:52:08.073398+00', false, true, 4180, 103);


--
-- Data for Name: wa_price_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."wa_price_items" ("id", "client_id", "category", "name", "unit", "price_min", "price_max", "currency", "notes", "sort_order", "created_at", "updated_at", "pdf_url") VALUES
	('f8bf52c8-3404-4827-95a2-50bddf044063', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Persianas', 'Arrollable Black Out', 'm²', 41.23, NULL, 'USD', 'Mín 1m×1m. Si ancho >2.80m: ×1.15. Si ancho >3.50m: ×1.30. No incluye instalación.', 1, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('e5c6a9f5-e952-4a4b-880e-6156750b694c', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Persianas', 'Arrollable Screen', 'm²', 42.50, NULL, 'USD', 'Mín 1m×1m. Si ancho >2.80m: ×1.15. Si ancho >3.50m: ×1.30. No incluye instalación.', 2, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('7284430d-41df-4d2a-8ae0-345fe6e68c5a', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Persianas', 'Arrollable Decorativa', 'm²', 42.50, NULL, 'USD', 'Mín 1m×1m. Si ancho >2.80m: ×1.15. Si ancho >3.50m: ×1.30. No incluye instalación.', 3, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('fde0a532-eab6-4e4e-b6fe-5e6a053466f1', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Persianas', 'Romana Black Out', 'm²', 46.75, NULL, 'USD', 'Mín 1m×1m. Máx ancho 3m. No incluye instalación.', 4, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('d787d026-cc39-44c4-aab5-7e9d19ee7885', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Persianas', 'Romana Decorativa', 'm²', 44.20, NULL, 'USD', 'Mín 1m×1m. Máx ancho 3m. No incluye instalación.', 5, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('5adfd6c6-4fe0-4689-a1bb-ad94b453e889', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Persianas', 'Romana Traslúcida', 'm²', 44.20, NULL, 'USD', 'Mín 1m×1m. Máx ancho 3m. No incluye instalación.', 6, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('74cac0fe-a108-4375-a3a2-322d1116bb6e', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Persianas', 'Panel Deslizante Black Out', 'm²', 63.75, NULL, 'USD', 'Mín 1m×1m. No incluye instalación ni accesorios especiales.', 7, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('6704357a-525e-4236-b099-5871a7b00690', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Persianas', 'Panel Deslizante Screen', 'm²', 63.75, NULL, 'USD', 'Mín 1m×1m. No incluye instalación ni accesorios especiales.', 8, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('56659517-054c-4098-b780-aefd1c1d137e', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Persianas', 'Panel Deslizante Decorativa', 'm²', 63.75, NULL, 'USD', 'Mín 1m×1m. No incluye instalación ni accesorios especiales.', 9, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('71987cf5-14e9-4557-9578-5a5760d5b033', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Persianas', 'Persiana de Madera', 'm²', 96.90, NULL, 'USD', 'Mín 1m×1m. Máx ancho 2.60m. No incluye instalación ni accesorios especiales.', 10, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('09ea6510-857c-4b3a-a510-447e1f464f20', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Persianas', 'Zebra / Sheer / Double Roller Premium', 'm²', 90.10, NULL, 'USD', 'Mín 1m×1m. Máx ancho 3m. No incluye instalación ni accesorios especiales.', 11, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('824723db-db9f-446f-ade8-e4df13605a54', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Persianas', 'Zebra / Sheer / Double Roller Semi Blackout', 'm²', 90.10, NULL, 'USD', 'Mín 1m×1m. Máx ancho 3m. No incluye instalación ni accesorios especiales.', 12, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('d2eb45ef-c374-4292-9d7d-783f62788ae5', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Verticales', 'Vertical PVC Liso', 'm²', 15.73, NULL, 'USD', 'Mín 1m×1m. Fórmula: (ancho×riel) + (ancho×cenefa) + (ancho×alto×material). No incluye instalación.', 1, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('4d83bccb-0894-4202-9a52-213e766ef94d', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Verticales', 'Vertical PVC Diseño', 'm²', 36.98, NULL, 'USD', 'Mín 1m×1m. Fórmula: (ancho×riel) + (ancho×cenefa) + (ancho×alto×material). No incluye instalación.', 2, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('36e193fa-ec34-4fac-b5f1-70d00b8229ac', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Verticales', 'Vertical PVC Tela', 'm²', 17.85, NULL, 'USD', 'Mín 1m×1m. Fórmula: (ancho×riel) + (ancho×cenefa) + (ancho×alto×material). No incluye instalación.', 3, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('94c616e3-b975-4b32-84c3-dc6d46cd3d71', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Verticales', 'Vertical — Riel', 'm lineal', 20.49, NULL, 'USD', 'Se cobra por metro de ancho. Se suma al precio del material.', 4, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('52d6a779-e683-400e-bb96-234984e79f93', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Verticales', 'Vertical — Cenefa', 'm lineal', 9.35, NULL, 'USD', 'Se cobra por metro de ancho. Se suma al precio del material.', 5, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('6f03f225-9a81-419d-890e-a6bc953a4327', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Toldos Retráctiles', 'Toldo 2.90m × 2.00m (manual)', 'unidad', 450.00, NULL, 'USD', 'Incluye instalación. Aplican restricciones. No incluye accesorios especiales.', 1, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('36644d66-799d-42c8-99a9-c4a87d1d9983', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Toldos Retráctiles', 'Toldo 3.95m × 2.50m (manual)', 'unidad', 540.00, NULL, 'USD', 'Incluye instalación. Aplican restricciones. No incluye accesorios especiales.', 2, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('3f765849-e308-4a1b-b90c-d8907aa72029', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Toldos Retráctiles', 'Toldo 3.95m × 2.50m (motorizado)', 'unidad', 720.00, NULL, 'USD', 'Incluye instalación. Aplican restricciones. No incluye accesorios especiales.', 3, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('d7a7c43b-af51-425a-a72b-2cadc5d7e786', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Deck', 'Deck WPC', 'm²', 85.50, NULL, 'USD', 'No incluye instalación ni estructura de tubo galvanizado de 2". Aplican restricciones.', 1, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL),
	('3bf18ed2-ab2c-40aa-91cb-e8245a2fac29', '0b7be905-9ee8-4a02-86b8-2b74b67e56fb', 'Piso Laminado SPC', 'Piso PVC 5mm', 'm²', 27.00, NULL, 'USD', 'No incluye instalación. Aplican restricciones.', 1, '2026-06-26 23:06:17.776481+00', '2026-06-26 23:06:17.776481+00', NULL);


--
-- PostgreSQL database dump complete
--

-- \unrestrict parmhlhue9ZKjgelm7dadp72lJkk3tghAlmtobM1urVbN02PskdKwTHrwDspDY4

RESET ALL;
