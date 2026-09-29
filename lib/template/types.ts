export type LayoutKind = "classic" | "panel";

export const FONT_OPTIONS = [
  { key: "montserrat", label: "Montserrat", css: "'Montserrat'" },
  { key: "poppins", label: "Poppins", css: "'Poppins'" },
  { key: "noto-sans", label: "Noto Sans", css: "'Noto Sans'" },
  { key: "source-sans-3", label: "Source Sans 3", css: "'Source Sans 3'" },
  { key: "noto-serif", label: "Noto Serif", css: "'Noto Serif'" },
  { key: "merriweather", label: "Merriweather", css: "'Merriweather'" },
] as const;
export type FontKey = (typeof FONT_OPTIONS)[number]["key"];

/** "asset:<uuid>" for an uploaded asset, "builtin:<name>" for bundled art, or null. */
export type AssetRef = string | null;

export interface FieldSlot {
  key: string;
  label: string;
  visible: boolean;
  span: 1 | 2 | 3;
  align: "left" | "center" | "right";
  bold?: boolean;
}

export type SectionId = "candidate" | "exam" | "auth";

export interface SectionConfig {
  id: SectionId;
  title: string;
  visible: boolean;
  columns: 1 | 2 | 3;
  fields: FieldSlot[];
}

export interface TemplateConfig {
  version: 1;
  layout: LayoutKind;
  page: {
    preset: "A4" | "Letter" | "custom";
    orientation: "portrait" | "landscape";
    widthMm: number;
    heightMm: number;
    marginMm: number;
    cardsPerPage: 1 | 2 | 3 | 4;
    gapMm: number;
  };
  branding: {
    orgName: string;
    subtitle: string;
    logo: AssetRef;
    secondaryLogo: AssetRef;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    panelBackground: string;
    fontFamily: FontKey;
    baseFontPt: number;
    headerStyle: "solid" | "light" | "minimal";
    border: "none" | "single" | "double" | "dashed";
    borderWidthPt: number;
    cornerRadiusMm: number;
    watermark: AssetRef;
    watermarkText: string;
    watermarkOpacity: number;
    backgroundImage: AssetRef;
    signatureImage: AssetRef;
    signatoryName: string;
    signatoryDesignation: string;
    stamp: AssetRef;
  };
  header: {
    examLine: string;
    sessionLine: string;
    title: string;
    subtitle: string;
    showIds: boolean;
  };
  sections: SectionConfig[];
  photo: {
    enabled: boolean;
    widthMm: number;
    heightMm: number;
    position: "left" | "right";
    rounded: boolean;
    placeholderText: string;
  };
  code: {
    enabled: boolean;
    kind: "qr" | "barcode";
    data: string;
    sizeMm: number;
    label: string;
  };
  instructions: {
    enabled: boolean;
    placement: "front" | "back";
    title: string;
    items: string[];
    acknowledgement: string;
  };
  panel: {
    leftTagline: string;
    contactTitle: string;
    contactLines: string[];
    footerNote: string;
    showCandidateSignatureBox: boolean;
  };
  dateFormat: "DD-MM-YYYY" | "DD/MM/YYYY" | "D MMM YYYY" | "YYYY-MM-DD";
  filenamePattern: string;
}
