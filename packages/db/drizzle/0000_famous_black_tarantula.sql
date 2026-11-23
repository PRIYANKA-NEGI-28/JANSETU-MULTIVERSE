CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_hi" text,
	"code" text NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"default_sla_hours" integer DEFAULT 48 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name"),
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "wards" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"number" text NOT NULL,
	"zone" text NOT NULL,
	"city" text DEFAULT 'Delhi NCR' NOT NULL,
	"boundary" geometry(MultiPolygon, 4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'citizen' NOT NULL,
	"phone" text,
	"department_id" text,
	"ward_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaint_clusters" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"department_id" text NOT NULL,
	"ward_id" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"centroid" geometry(Point, 4326) NOT NULL,
	"complaint_count" integer DEFAULT 1 NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaint_events" (
	"id" text PRIMARY KEY NOT NULL,
	"complaint_id" text NOT NULL,
	"actor_id" text,
	"actor_role" text NOT NULL,
	"event_type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" text PRIMARY KEY NOT NULL,
	"tracking_code" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"citizen_id" text,
	"department_id" text NOT NULL,
	"ward_id" text NOT NULL,
	"cluster_id" text,
	"category" text NOT NULL,
	"urgency" text DEFAULT 'MEDIUM' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"raw_text" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"citizen_name" text DEFAULT 'Anonymous' NOT NULL,
	"citizen_phone" text,
	"exact_location" geometry(Point, 4326) NOT NULL,
	"public_location" geometry(Point, 4326) NOT NULL,
	"photo_url" text,
	"assigned_officer_id" text,
	"sla_due_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"escalated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"device_uid" text NOT NULL,
	"device_type" text DEFAULT 'STREETLIGHT' NOT NULL,
	"ward_id" text,
	"department_id" text,
	"location" geometry(Point, 4326) NOT NULL,
	"status" text DEFAULT 'NORMAL' NOT NULL,
	"battery_level" integer,
	"last_heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_telemetry" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"event_type" text NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rti_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"citizen_id" text,
	"applicant_name" text NOT NULL,
	"father_or_spouse_name" text,
	"address" text NOT NULL,
	"contact_number" text NOT NULL,
	"email" text,
	"bpl_card_no" text,
	"bpl_year" text,
	"authority_name" text NOT NULL,
	"public_authority_address" text,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"specific_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"english_draft" text NOT NULL,
	"hindi_draft" text NOT NULL,
	"is_bpl_exempt" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_clusters" ADD CONSTRAINT "complaint_clusters_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_clusters" ADD CONSTRAINT "complaint_clusters_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_events" ADD CONSTRAINT "complaint_events_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_events" ADD CONSTRAINT "complaint_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_citizen_id_users_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_cluster_id_complaint_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."complaint_clusters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assigned_officer_id_users_id_fk" FOREIGN KEY ("assigned_officer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_telemetry" ADD CONSTRAINT "iot_telemetry_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rti_applications" ADD CONSTRAINT "rti_applications_citizen_id_users_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_wards_boundary" ON "wards" USING gist ("boundary");--> statement-breakpoint
CREATE INDEX "idx_wards_city_number" ON "wards" USING btree ("city","number");--> statement-breakpoint
CREATE INDEX "idx_clusters_centroid" ON "complaint_clusters" USING gist ("centroid");--> statement-breakpoint
CREATE INDEX "idx_clusters_dept_ward_status" ON "complaint_clusters" USING btree ("department_id","ward_id","status");--> statement-breakpoint
CREATE INDEX "idx_events_complaint_created" ON "complaint_events" USING btree ("complaint_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_complaints_tracking_code" ON "complaints" USING btree ("tracking_code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_complaints_idempotency_key" ON "complaints" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_complaints_public_location" ON "complaints" USING gist ("public_location");--> statement-breakpoint
CREATE INDEX "idx_complaints_ward_dept_status" ON "complaints" USING btree ("ward_id","department_id","status");--> statement-breakpoint
CREATE INDEX "idx_complaints_status_sla_due" ON "complaints" USING btree ("status","sla_due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_iot_devices_device_uid" ON "iot_devices" USING btree ("device_uid");--> statement-breakpoint
CREATE INDEX "idx_iot_devices_location" ON "iot_devices" USING gist ("location");--> statement-breakpoint
CREATE INDEX "idx_iot_devices_ward_status" ON "iot_devices" USING btree ("ward_id","status");--> statement-breakpoint
CREATE INDEX "idx_telemetry_device_recorded" ON "iot_telemetry" USING btree ("device_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_rti_citizen_created" ON "rti_applications" USING btree ("citizen_id","created_at");