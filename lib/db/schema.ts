import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { TemplateConfig } from "@/lib/template/types";
import type { FieldMapping } from "@/lib/fields";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  retentionDays: integer("retention_days").notNull().default(30),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("admin"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id"),
    kind: text("kind").notNull(), // logo | signature | stamp | watermark | background | photo
    originalName: text("original_name").notNull(),
    storageKey: text("storage_key").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assets_org_idx").on(t.orgId), index("assets_batch_idx").on(t.batchId, t.kind)],
);

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    config: jsonb("config").$type<TemplateConfig>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("templates_org_idx").on(t.orgId)],
);

export const mappingPresets = pgTable(
  "mapping_presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mapping: jsonb("mapping").$type<FieldMapping>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("mapping_presets_org_idx").on(t.orgId)],
);

export type BatchStatus =
  | "draft"
  | "imported"
  | "generating"
  | "completed"
  | "completed_with_errors"
  | "cancelled";

export const batches = pgTable(
  "batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    examName: text("exam_name").notNull().default(""),
    session: text("session").notNull().default(""),
    status: text("status").$type<BatchStatus>().notNull().default("draft"),
    templateId: uuid("template_id"),
    templateSnapshot: jsonb("template_snapshot").$type<TemplateConfig>(),
    mapping: jsonb("mapping").$type<FieldMapping>(),
    csvFileName: text("csv_file_name"),
    csvSize: integer("csv_size"),
    duplicatePolicy: text("duplicate_policy").notNull().default("skip"),
    isDemo: boolean("is_demo").notNull().default(false),
    combinedKey: text("combined_key"),
    combinedSort: text("combined_sort"),
    combinedAt: timestamp("combined_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("batches_org_idx").on(t.orgId, t.createdAt)],
);

export type RecordStatus = "valid" | "invalid" | "duplicate";
export type GenStatus = "pending" | "queued" | "processing" | "done" | "failed";

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    name: text("name").notNull().default(""),
    rollNumber: text("roll_number").notNull().default(""),
    applicationNumber: text("application_number").notNull().default(""),
    examName: text("exam_name").notNull().default(""),
    data: jsonb("data").$type<Record<string, string>>().notNull(),
    dataHash: text("data_hash").notNull().default(""),
    recordStatus: text("record_status").$type<RecordStatus>().notNull().default("valid"),
    flagged: boolean("flagged").notNull().default(false),
    errors: jsonb("errors").$type<{ field: string; message: string }[]>().notNull().default([]),
    genStatus: text("gen_status").$type<GenStatus>().notNull().default("pending"),
    genError: text("gen_error"),
    attempts: integer("attempts").notNull().default(0),
    fileKey: text("file_key"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    jobId: uuid("job_id"),
  },
  (t) => [
    index("candidates_batch_idx").on(t.batchId, t.rowNumber),
    index("candidates_org_idx").on(t.orgId),
    index("candidates_gen_idx").on(t.batchId, t.genStatus),
    index("candidates_roll_idx").on(t.batchId, t.rollNumber),
  ],
);

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    status: text("status").$type<JobStatus>().notNull().default("queued"),
    total: integer("total").notNull().default(0),
    completed: integer("completed").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    cancelRequested: boolean("cancel_requested").notNull().default(false),
    error: text("error"),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    elapsedMs: bigint("elapsed_ms", { mode: "number" }).notNull().default(0),
  },
  (t) => [
    index("jobs_batch_idx").on(t.batchId),
    // Only one active job per batch — guards against duplicate processing.
    uniqueIndex("jobs_one_active_per_batch")
      .on(t.batchId)
      .where(sql`status in ('queued','running')`),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type Batch = typeof batches.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type MappingPreset = typeof mappingPresets.$inferSelect;
