import type { FieldMapping } from "@/lib/fields";
import type { BatchStats } from "@/lib/services/batch-stats-type";

export interface WizardBatch {
  id: string;
  name: string;
  examName: string;
  status: string;
  mapping: FieldMapping | null;
  templateId: string | null;
  hasTemplate: boolean;
  csvFileName: string | null;
  isDemo: boolean;
}

export interface TemplateSummary {
  id: string;
  name: string;
  layout: string;
  updatedAt: string;
}

export interface PresetSummary {
  id: string;
  name: string;
  mapping: FieldMapping;
}

export interface ParsedFile {
  name: string;
  size: number;
  encoding: string;
  headers: string[];
  rows: Record<string, string>[];
  warnings: string[];
}

export type { BatchStats };
