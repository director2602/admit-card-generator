CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"batch_id" uuid,
	"kind" text NOT NULL,
	"original_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"exam_name" text DEFAULT '' NOT NULL,
	"session" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"template_id" uuid,
	"template_snapshot" jsonb,
	"mapping" jsonb,
	"csv_file_name" text,
	"csv_size" integer,
	"duplicate_policy" text DEFAULT 'skip' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"combined_key" text,
	"combined_sort" text,
	"combined_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"roll_number" text DEFAULT '' NOT NULL,
	"application_number" text DEFAULT '' NOT NULL,
	"exam_name" text DEFAULT '' NOT NULL,
	"data" jsonb NOT NULL,
	"data_hash" text DEFAULT '' NOT NULL,
	"record_status" text DEFAULT 'valid' NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gen_status" text DEFAULT 'pending' NOT NULL,
	"gen_error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"file_key" text,
	"file_name" text,
	"file_size" integer,
	"generated_at" timestamp with time zone,
	"job_id" uuid
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"completed" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"error" text,
	"heartbeat_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"elapsed_ms" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mapping_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mapping" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_presets" ADD CONSTRAINT "mapping_presets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_org_idx" ON "assets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "assets_batch_idx" ON "assets" USING btree ("batch_id","kind");--> statement-breakpoint
CREATE INDEX "batches_org_idx" ON "batches" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "candidates_batch_idx" ON "candidates" USING btree ("batch_id","row_number");--> statement-breakpoint
CREATE INDEX "candidates_org_idx" ON "candidates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "candidates_gen_idx" ON "candidates" USING btree ("batch_id","gen_status");--> statement-breakpoint
CREATE INDEX "candidates_roll_idx" ON "candidates" USING btree ("batch_id","roll_number");--> statement-breakpoint
CREATE INDEX "jobs_batch_idx" ON "jobs" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_one_active_per_batch" ON "jobs" USING btree ("batch_id") WHERE status in ('queued','running');--> statement-breakpoint
CREATE INDEX "mapping_presets_org_idx" ON "mapping_presets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "templates_org_idx" ON "templates" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");