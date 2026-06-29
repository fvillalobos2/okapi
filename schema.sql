


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "business_id" "uuid",
    "lead_id" "uuid",
    "client_phone" "text",
    "booking_details" "jsonb" DEFAULT '{}'::"jsonb",
    "booking_text" "text",
    "order_number" "text",
    "provider_number" "text",
    "provider_id" "uuid",
    "rental_amount" numeric(10,2),
    "fee_amount" numeric(10,2),
    "currency" "text" DEFAULT 'USD'::"text",
    "commission_pct_offered" numeric(5,2),
    "commission_pct_final" numeric(5,2),
    "commission_negotiation_status" "text" DEFAULT 'pending'::"text",
    "commission_counter_offer" numeric(5,2),
    "payment_status" "text" DEFAULT 'pending'::"text",
    "modification_requests" "jsonb" DEFAULT '[]'::"jsonb",
    "provider_contacted_at" timestamp with time zone,
    "provider_responded_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "link_sent" boolean DEFAULT false,
    "follow_up_sent" boolean DEFAULT false,
    "payment_processed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "provider_messages" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "bookings_commission_negotiation_status_check" CHECK (("commission_negotiation_status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'countered'::"text"]))),
    CONSTRAINT "bookings_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "whatsapp_number" "text" NOT NULL,
    "twilio_sender" "text" NOT NULL,
    "base_prompt" "text",
    "tone_rules" "text",
    "active" boolean DEFAULT true,
    "default_commission_pct" numeric(5,2) DEFAULT 10.0,
    "min_commission_pct" numeric(5,2) DEFAULT 5.0,
    "auto_accept_counter_within_pct" numeric(5,2) DEFAULT 2.0,
    "admin_whatsapp" "text",
    "follow_up_hours" integer DEFAULT 24,
    "provider_timeout_hours" integer DEFAULT 4,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."businesses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "business_id" "uuid",
    "phone" "text" NOT NULL,
    "messages" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'active'::"text",
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "conversations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'booked'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "phone" "text" NOT NULL,
    "name" "text",
    "email" "text",
    "source_url" "text",
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "referrer" "text",
    "status" "text" DEFAULT 'new'::"text",
    "follow_up_sent_at" timestamp with time zone,
    "follow_up_responded" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_active_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "leads_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'active'::"text", 'booked'::"text", 'lost'::"text"])))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "booking_id" "uuid",
    "lead_phone" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_cancellations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_phone" "text" NOT NULL,
    "business_id" "uuid",
    "type" "text" NOT NULL,
    "order_number" "text",
    "provider_number" "text",
    "booking_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pending_cancellations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompt_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "prompt_snapshot" "text" NOT NULL,
    "created_by" "text" DEFAULT 'admin'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT false
);


ALTER TABLE "public"."prompt_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "location_name" "text" NOT NULL,
    "whatsapp_number" "text" NOT NULL,
    "default_commission_pct" numeric(5,2) DEFAULT 10.0,
    "active" boolean DEFAULT true,
    "avg_response_time_minutes" numeric(8,2),
    "acceptance_rate" numeric(5,2) DEFAULT 100.0,
    "total_bookings" integer DEFAULT 0,
    "total_rejected" integer DEFAULT 0,
    "whatsapp_verified" boolean DEFAULT false
);


ALTER TABLE "public"."providers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "price_range" "text",
    "booking_flow_steps" "jsonb" DEFAULT '[]'::"jsonb",
    "active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "twilio_number" "text" NOT NULL,
    "system_prompt" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "website" "text",
    "instagram" "text",
    "facebook" "text",
    "phone_display" "text",
    "email" "text",
    "address" "text",
    "city" "text",
    "country" "text" DEFAULT 'Costa Rica'::"text",
    "business_hours" "text",
    "description" "text",
    "financing_info" "text",
    "warranty_info" "text",
    "service_area" "text",
    "pipedrive_pipeline_id" integer DEFAULT 3,
    "pipedrive_stage_id" integer DEFAULT 19,
    "sales_whatsapp" "text",
    "pipedrive_escalation_stage_id" integer DEFAULT 23,
    "pipedrive_product_field_key" "text"
);


ALTER TABLE "public"."wa_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "customer_phone" "text" NOT NULL,
    "customer_name" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pipedrive_deal_id" integer,
    "pipedrive_sent_at" timestamp with time zone,
    "customer_email" "text",
    "pipedrive_person_id" integer,
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_content" "text",
    "utm_term" "text",
    "gclid" "text",
    "archived" boolean DEFAULT false NOT NULL,
    "fbclid" "text",
    "customer_phone_alt" "text",
    "follow_up_sent_at" timestamp with time zone,
    "follow_up_step" integer DEFAULT 0 NOT NULL,
    "product_interest" "text",
    "deal_value" numeric,
    "sla_alerted_at" timestamp with time zone,
    CONSTRAINT "wa_conversations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'pending_human'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."wa_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_discounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "value" numeric(10,2) NOT NULL,
    "condition" "text",
    "active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "wa_discounts_type_check" CHECK (("type" = ANY (ARRAY['percentage'::"text", 'fixed'::"text"])))
);


ALTER TABLE "public"."wa_discounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_follow_up_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "delay_hours" integer DEFAULT 24 NOT NULL,
    "message" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wa_follow_up_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "direction" "text" NOT NULL,
    "body" "text" NOT NULL,
    "approved_by" "text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "needs_approval" boolean DEFAULT false,
    "approved" boolean DEFAULT false,
    "input_tokens" integer,
    "output_tokens" integer,
    CONSTRAINT "wa_messages_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"])))
);


ALTER TABLE "public"."wa_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_price_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "category" "text" NOT NULL,
    "name" "text" NOT NULL,
    "unit" "text" DEFAULT 'm²'::"text" NOT NULL,
    "price_min" numeric(10,2),
    "price_max" numeric(10,2),
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "notes" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pdf_url" "text"
);


ALTER TABLE "public"."wa_price_items" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_business_id_phone_key" UNIQUE ("business_id", "phone");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_cancellations"
    ADD CONSTRAINT "pending_cancellations_client_phone_key" UNIQUE ("client_phone");



ALTER TABLE ONLY "public"."pending_cancellations"
    ADD CONSTRAINT "pending_cancellations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_versions"
    ADD CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_clients"
    ADD CONSTRAINT "wa_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_clients"
    ADD CONSTRAINT "wa_clients_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."wa_conversations"
    ADD CONSTRAINT "wa_conversations_client_id_customer_phone_key" UNIQUE ("client_id", "customer_phone");



ALTER TABLE ONLY "public"."wa_conversations"
    ADD CONSTRAINT "wa_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_discounts"
    ADD CONSTRAINT "wa_discounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_follow_up_configs"
    ADD CONSTRAINT "wa_follow_up_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_messages"
    ADD CONSTRAINT "wa_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_price_items"
    ADD CONSTRAINT "wa_price_items_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_bookings_business" ON "public"."bookings" USING "btree" ("business_id");



CREATE INDEX "idx_bookings_client" ON "public"."bookings" USING "btree" ("client_phone");



CREATE INDEX "idx_bookings_order" ON "public"."bookings" USING "btree" ("order_number");



CREATE INDEX "idx_bookings_provider" ON "public"."bookings" USING "btree" ("provider_number");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("business_id", "payment_status");



CREATE INDEX "idx_conversations_business" ON "public"."conversations" USING "btree" ("business_id");



CREATE INDEX "idx_conversations_phone" ON "public"."conversations" USING "btree" ("phone");



CREATE INDEX "idx_leads_business_status" ON "public"."leads" USING "btree" ("business_id", "status");



CREATE INDEX "idx_leads_phone" ON "public"."leads" USING "btree" ("phone");



CREATE INDEX "idx_providers_location" ON "public"."providers" USING "btree" ("business_id", "location_name");



CREATE INDEX "idx_providers_number" ON "public"."providers" USING "btree" ("whatsapp_number");



CREATE INDEX "idx_wa_conversations_client_status" ON "public"."wa_conversations" USING "btree" ("client_id", "status");



CREATE INDEX "idx_wa_conversations_search" ON "public"."wa_conversations" USING "gin" ("to_tsvector"('"spanish"'::"regconfig", ((((((COALESCE("customer_name", ''::"text") || ' '::"text") || COALESCE("customer_email", ''::"text")) || ' '::"text") || COALESCE("customer_phone", ''::"text")) || ' '::"text") || COALESCE("product_interest", ''::"text"))));



CREATE INDEX "idx_wa_conversations_updated_at" ON "public"."wa_conversations" USING "btree" ("updated_at");



CREATE INDEX "idx_wa_messages_conversation_id" ON "public"."wa_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_wa_messages_direction" ON "public"."wa_messages" USING "btree" ("direction");



CREATE INDEX "idx_wa_messages_sent_at" ON "public"."wa_messages" USING "btree" ("sent_at");



CREATE INDEX "wa_conversations_client_id_status_idx" ON "public"."wa_conversations" USING "btree" ("client_id", "status");



CREATE INDEX "wa_discounts_client_id_active_idx" ON "public"."wa_discounts" USING "btree" ("client_id", "active");



CREATE INDEX "wa_messages_conversation_id_sent_at_idx" ON "public"."wa_messages" USING "btree" ("conversation_id", "sent_at");



CREATE INDEX "wa_price_items_client_id_category_idx" ON "public"."wa_price_items" USING "btree" ("client_id", "category");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_cancellations"
    ADD CONSTRAINT "pending_cancellations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."prompt_versions"
    ADD CONSTRAINT "prompt_versions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wa_conversations"
    ADD CONSTRAINT "wa_conversations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."wa_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wa_discounts"
    ADD CONSTRAINT "wa_discounts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."wa_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wa_follow_up_configs"
    ADD CONSTRAINT "wa_follow_up_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."wa_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wa_messages"
    ADD CONSTRAINT "wa_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."wa_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wa_price_items"
    ADD CONSTRAINT "wa_price_items_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."wa_clients"("id") ON DELETE CASCADE;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."wa_conversations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."wa_messages";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





































































































































































GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."businesses" TO "anon";
GRANT ALL ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."pending_cancellations" TO "anon";
GRANT ALL ON TABLE "public"."pending_cancellations" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_cancellations" TO "service_role";



GRANT ALL ON TABLE "public"."prompt_versions" TO "anon";
GRANT ALL ON TABLE "public"."prompt_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."prompt_versions" TO "service_role";



GRANT ALL ON TABLE "public"."providers" TO "anon";
GRANT ALL ON TABLE "public"."providers" TO "authenticated";
GRANT ALL ON TABLE "public"."providers" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."wa_clients" TO "anon";
GRANT ALL ON TABLE "public"."wa_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_clients" TO "service_role";



GRANT ALL ON TABLE "public"."wa_conversations" TO "anon";
GRANT ALL ON TABLE "public"."wa_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."wa_discounts" TO "anon";
GRANT ALL ON TABLE "public"."wa_discounts" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_discounts" TO "service_role";



GRANT ALL ON TABLE "public"."wa_follow_up_configs" TO "anon";
GRANT ALL ON TABLE "public"."wa_follow_up_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_follow_up_configs" TO "service_role";



GRANT ALL ON TABLE "public"."wa_messages" TO "anon";
GRANT ALL ON TABLE "public"."wa_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_messages" TO "service_role";



GRANT ALL ON TABLE "public"."wa_price_items" TO "anon";
GRANT ALL ON TABLE "public"."wa_price_items" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_price_items" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































