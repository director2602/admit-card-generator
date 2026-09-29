import { z } from "zod";
import { FONT_OPTIONS, type TemplateConfig } from "./types";

const color = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Invalid colour");
const assetRef = z
  .string()
  .regex(/^(asset:[0-9a-f-]{36}|builtin:[a-z0-9-]{1,40})$/)
  .nullable();
const str = (max: number) => z.string().max(max);

const fieldSlot = z.object({
  key: z.string().regex(/^[a-z0-9_]{1,48}$/),
  label: str(80),
  visible: z.boolean(),
  span: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  align: z.enum(["left", "center", "right"]),
  bold: z.boolean().optional(),
});

const section = z.object({
  id: z.enum(["candidate", "exam", "auth"]),
  title: str(80),
  visible: z.boolean(),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  fields: z.array(fieldSlot).max(40),
});

export const templateConfigSchema = z.object({
  version: z.literal(1),
  layout: z.enum(["classic", "panel"]),
  page: z.object({
    preset: z.enum(["A4", "Letter", "custom"]),
    orientation: z.enum(["portrait", "landscape"]),
    widthMm: z.number().min(50).max(600),
    heightMm: z.number().min(40).max(900),
    marginMm: z.number().min(0).max(40),
    cardsPerPage: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    gapMm: z.number().min(0).max(40),
  }),
  branding: z.object({
    orgName: str(160),
    subtitle: str(200),
    logo: assetRef,
    secondaryLogo: assetRef,
    primary: color,
    secondary: color,
    accent: color,
    text: color,
    panelBackground: color,
    fontFamily: z.enum(FONT_OPTIONS.map((f) => f.key) as [string, ...string[]]),
    baseFontPt: z.number().min(6).max(16),
    headerStyle: z.enum(["solid", "light", "minimal"]),
    border: z.enum(["none", "single", "double", "dashed"]),
    borderWidthPt: z.number().min(0).max(6),
    cornerRadiusMm: z.number().min(0).max(10),
    watermark: assetRef,
    watermarkText: str(60),
    watermarkOpacity: z.number().min(0).max(0.5),
    backgroundImage: assetRef,
    signatureImage: assetRef,
    signatoryName: str(100),
    signatoryDesignation: str(100),
    stamp: assetRef,
  }),
  header: z.object({
    examLine: str(200),
    sessionLine: str(200),
    title: str(80),
    subtitle: str(80),
    showIds: z.boolean(),
  }),
  sections: z.array(section).max(3),
  photo: z.object({
    enabled: z.boolean(),
    widthMm: z.number().min(15).max(80),
    heightMm: z.number().min(15).max(100),
    position: z.enum(["left", "right"]),
    rounded: z.boolean(),
    placeholderText: str(100),
  }),
  code: z.object({
    enabled: z.boolean(),
    kind: z.enum(["qr", "barcode"]),
    data: str(300),
    sizeMm: z.number().min(10).max(60),
    label: str(60),
  }),
  instructions: z.object({
    enabled: z.boolean(),
    placement: z.enum(["front", "back"]),
    title: str(100),
    items: z.array(str(400)).max(30),
    acknowledgement: str(300),
  }),
  panel: z.object({
    leftTagline: str(200),
    contactTitle: str(100),
    contactLines: z.array(str(150)).max(20),
    footerNote: str(400),
    showCandidateSignatureBox: z.boolean(),
  }),
  dateFormat: z.enum(["DD-MM-YYYY", "DD/MM/YYYY", "D MMM YYYY", "YYYY-MM-DD"]),
  filenamePattern: str(120),
});

export function parseTemplateConfig(input: unknown): TemplateConfig {
  return templateConfigSchema.parse(input) as TemplateConfig;
}
