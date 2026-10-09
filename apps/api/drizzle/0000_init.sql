CREATE TABLE "access_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"distributor_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"shop_name" text NOT NULL,
	"address" text,
	"location_label" text,
	"status" text NOT NULL,
	"retailer_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_requests_status_check" CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);
--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"distributor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'CIRCLE' NOT NULL,
	"center_lat" numeric(9, 6) NOT NULL,
	"center_lng" numeric(9, 6) NOT NULL,
	"radius_m" integer,
	"polygon" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_zones_kind_check" CHECK (kind IN ('CIRCLE', 'POLYGON')),
	CONSTRAINT "delivery_zones_radius_check" CHECK ("delivery_zones"."radius_m" BETWEEN 500 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "distributors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_slug" text NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"password_changed_at" timestamp with time zone NOT NULL,
	"business_name" text,
	"owner_name" text,
	"email" text,
	"address" text,
	"gstin" text,
	"logo_key" text,
	"status" text NOT NULL,
	"order_seq" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "distributors_publicSlug_unique" UNIQUE("public_slug"),
	CONSTRAINT "distributors_phone_unique" UNIQUE("phone"),
	CONSTRAINT "distributors_status_check" CHECK (status IN ('ONBOARDING', 'ACTIVE', 'SUSPENDED')),
	CONSTRAINT "distributors_order_seq_check" CHECK ("distributors"."order_seq" >= 0)
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"distributor_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enquiries_status_check" CHECK (status IN ('NEW', 'READ', 'CLOSED'))
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"distributor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"unit" text NOT NULL,
	"rate_paise" bigint NOT NULL,
	"stock_qty" numeric(12, 3) DEFAULT '0' NOT NULL,
	"low_stock_threshold" numeric(12, 3) DEFAULT '0' NOT NULL,
	"category" text,
	"description" text,
	"image_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_unit_check" CHECK (unit IN ('PCS', 'BOX', 'DOZEN', 'PACK', 'CASE', 'KG', 'G', 'L', 'ML')),
	CONSTRAINT "items_rate_check" CHECK ("items"."rate_paise" >= 0),
	CONSTRAINT "items_stock_check" CHECK ("items"."stock_qty" >= 0),
	CONSTRAINT "items_threshold_check" CHECK ("items"."low_stock_threshold" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"distributor_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid,
	"from_status" text,
	"to_status" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_events_actor_check" CHECK (actor_type IN ('DISTRIBUTOR', 'RETAILER', 'SYSTEM'))
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"distributor_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"item_name_snapshot" text NOT NULL,
	"unit_snapshot" text NOT NULL,
	"rate_paise_snapshot" bigint NOT NULL,
	"requested_qty" numeric(12, 3) NOT NULL,
	"accepted_qty" numeric(12, 3),
	"requested_paise" bigint NOT NULL,
	"accepted_paise" bigint,
	"line_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_requested_check" CHECK ("order_items"."requested_qty" > 0),
	CONSTRAINT "order_items_accepted_check" CHECK ("order_items"."accepted_qty" >= 0 AND "order_items"."accepted_qty" <= "order_items"."requested_qty")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"distributor_id" uuid NOT NULL,
	"retailer_id" uuid NOT NULL,
	"order_no" integer NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"rejection_reason" text,
	"total_requested_paise" bigint NOT NULL,
	"total_accepted_paise" bigint,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"session_id" uuid,
	"new_device" boolean DEFAULT false NOT NULL,
	"decided_at" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_status_check" CHECK (status IN ('PENDING', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'CANCELLED', 'DISPATCHED', 'DELIVERED'))
);
--> statement-breakpoint
CREATE TABLE "password_reset_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"distributor_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retailers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"distributor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"shop_name" text,
	"phone" text NOT NULL,
	"email" text,
	"address" text,
	"shop_photo_key" text,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"location_label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retailers_source_check" CHECK (source IN ('MANUAL', 'ACCESS_REQUEST'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"distributor_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"device_fingerprint" text,
	"device_info" text,
	"ip" "inet",
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_subject_check" CHECK (subject_type IN ('DISTRIBUTOR', 'RETAILER'))
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"distributor_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"type" text NOT NULL,
	"delta_qty" numeric(12, 3) NOT NULL,
	"balance_after" numeric(12, 3) NOT NULL,
	"rate_paise_snapshot" bigint,
	"amount_paise" bigint,
	"order_id" uuid,
	"order_item_id" uuid,
	"reason" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_orderItemId_unique" UNIQUE("order_item_id"),
	CONSTRAINT "stock_movements_type_check" CHECK (type IN ('OPENING', 'RESTOCK', 'SALE', 'ADJUSTMENT')),
	CONSTRAINT "stock_movements_delta_check" CHECK ("stock_movements"."delta_qty" <> 0),
	CONSTRAINT "stock_movements_balance_check" CHECK ("stock_movements"."balance_after" >= 0),
	CONSTRAINT "stock_movements_reason_check" CHECK ("stock_movements"."type" <> 'ADJUSTMENT' OR length("stock_movements"."reason") >= 3)
);
--> statement-breakpoint
CREATE TABLE "storefronts" (
	"distributor_id" uuid PRIMARY KEY NOT NULL,
	"tagline" text,
	"owner_note" text,
	"cover_key" text,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"brands" text[] DEFAULT '{}'::text[] NOT NULL,
	"opening_hours" jsonb,
	"same_day_cutoff" time,
	"godown_lat" numeric(9, 6),
	"godown_lng" numeric(9, 6),
	"godown_label" text,
	"featured_item_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retailers" ADD CONSTRAINT "retailers_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefronts" ADD CONSTRAINT "storefronts_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_requests_pending_uq" ON "access_requests" USING btree ("distributor_id","phone") WHERE "access_requests"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "access_requests_idx" ON "access_requests" USING btree ("distributor_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "delivery_zones_idx" ON "delivery_zones" USING btree ("distributor_id","sort_order");--> statement-breakpoint
CREATE INDEX "enquiries_idx" ON "enquiries" USING btree ("distributor_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "items_active_idx" ON "items" USING btree ("distributor_id","is_active") WHERE "items"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "items_sku_uq" ON "items" USING btree ("distributor_id","sku") WHERE "items"."sku" IS NOT NULL AND "items"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_no_uq" ON "orders" USING btree ("distributor_id","order_no");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idem_uq" ON "orders" USING btree ("retailer_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "orders_inbox_idx" ON "orders" USING btree ("distributor_id","status","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "orders_retailer_idx" ON "orders" USING btree ("retailer_id","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE UNIQUE INDEX "retailers_phone_uq" ON "retailers" USING btree ("distributor_id","phone");--> statement-breakpoint
CREATE INDEX "sessions_subject_idx" ON "sessions" USING btree ("subject_type","subject_id") WHERE "sessions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "stock_movements_item_idx" ON "stock_movements" USING btree ("distributor_id","item_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "stock_movements_report_idx" ON "stock_movements" USING btree ("distributor_id","type","created_at");