import type { FieldSlot, SectionConfig, TemplateConfig } from "./types";

const slot = (key: string, label: string, span: 1 | 2 | 3 = 1, extra: Partial<FieldSlot> = {}): FieldSlot => ({
  key,
  label,
  visible: true,
  span,
  align: "left",
  ...extra,
});

export const DEFAULT_INSTRUCTIONS = [
  "Carry this admit card along with one original, valid photo identity proof (Aadhaar, school ID, passport, voter ID or driving licence).",
  "Report at the examination centre by the reporting time. Entry closes at the gate closing time — no candidate will be admitted after that.",
  "Candidates must occupy only the seat allotted to their roll number.",
  "Mobile phones, smart watches, calculators, electronic devices, notes and bags are strictly prohibited inside the examination hall.",
  "Bring a blue or black ball-point pen. Do not write anything on the admit card.",
  "Any unfair means or impersonation will lead to disqualification and legal action.",
  "Retain this admit card until the results are declared.",
];

const classicSections: SectionConfig[] = [
  {
    id: "candidate",
    title: "Candidate Details",
    visible: true,
    columns: 2,
    fields: [
      slot("candidate_name", "Candidate Name", 2, { bold: true }),
      slot("father_name", "Father's / Guardian's Name", 2),
      slot("date_of_birth", "Date of Birth"),
      slot("gender", "Gender"),
      slot("category", "Category"),
      slot("registration_number", "Registration No."),
    ],
  },
  {
    id: "exam",
    title: "Examination Details",
    visible: true,
    columns: 3,
    fields: [
      slot("exam_date", "Exam Date"),
      slot("exam_time", "Exam Time"),
      slot("shift", "Shift / Session"),
      slot("reporting_time", "Reporting Time"),
      slot("gate_closing_time", "Gate Closing Time"),
      slot("exam_duration", "Duration"),
      slot("exam_center", "Examination Centre", 3, { bold: true }),
      slot("center_address", "Centre Address", 3),
    ],
  },
  {
    id: "auth",
    title: "Authentication",
    visible: true,
    columns: 3,
    fields: [
      slot("sig_candidate", "Candidate's Signature"),
      slot("sig_invigilator", "Invigilator's Signature"),
      slot("sig_authority", "Authorised Signatory"),
    ],
  },
];

export function defaultTemplate(): TemplateConfig {
  return {
    version: 1,
    layout: "classic",
    page: { preset: "A4", orientation: "portrait", widthMm: 210, heightMm: 297, marginMm: 10, cardsPerPage: 1, gapMm: 6 },
    branding: {
      orgName: "Your Organisation Name",
      subtitle: "Examination Authority",
      logo: "builtin:demo-logo",
      secondaryLogo: null,
      primary: "#1f2a5c",
      secondary: "#3c4b8f",
      accent: "#b8862b",
      text: "#1a1d29",
      panelBackground: "#f4f5fa",
      fontFamily: "noto-sans",
      baseFontPt: 9.5,
      headerStyle: "solid",
      border: "double",
      borderWidthPt: 1.2,
      cornerRadiusMm: 2,
      watermark: null,
      watermarkText: "",
      watermarkOpacity: 0.06,
      backgroundImage: null,
      signatureImage: null,
      signatoryName: "",
      signatoryDesignation: "Controller of Examinations",
      stamp: null,
    },
    header: {
      examLine: "{{exam_name}}",
      sessionLine: "Session 2026–27",
      title: "ADMIT CARD",
      subtitle: "HALL TICKET",
      showIds: true,
    },
    sections: classicSections,
    photo: { enabled: true, widthMm: 32, heightMm: 40, position: "right", rounded: false, placeholderText: "Affix recent passport-size photograph" },
    code: { enabled: true, kind: "qr", data: "{{roll_number}}|{{application_number}}", sizeMm: 24, label: "Scan to verify" },
    instructions: {
      enabled: true,
      placement: "front",
      title: "Important Instructions",
      items: DEFAULT_INSTRUCTIONS,
      acknowledgement: "I have read and understood the instructions and agree to abide by them.",
    },
    panel: {
      leftTagline: "",
      contactTitle: "For any query, please contact:",
      contactLines: [],
      footerNote: "",
      showCandidateSignatureBox: true,
    },
    dateFormat: "DD-MM-YYYY",
    filenamePattern: "AdmitCard_{{roll_number}}",
  };
}

/** Three-panel landscape design modelled on the S-CUBUS SATHII exam admit card. */
export function sathiiTemplate(): TemplateConfig {
  const base = defaultTemplate();
  return {
    ...base,
    layout: "panel",
    page: { preset: "custom", orientation: "landscape", widthMm: 260, heightMm: 106, marginMm: 3, cardsPerPage: 1, gapMm: 6 },
    branding: {
      ...base.branding,
      orgName: "S-CUBUS Career Pvt. Ltd.",
      subtitle: "SATHII — S-CUBUS Aptitude & Talent Hunt",
      logo: "builtin:sathii-logo",
      secondaryLogo: "builtin:scubus-logo",
      primary: "#3f0c47",
      secondary: "#c5b6c9",
      accent: "#f0801e",
      text: "#371641",
      panelBackground: "#ffffff",
      fontFamily: "montserrat",
      baseFontPt: 10,
      headerStyle: "solid",
      border: "single",
      borderWidthPt: 0.8,
      cornerRadiusMm: 0,
    },
    header: { examLine: "", sessionLine: "", title: "SATHII EXAM ADMIT CARD", subtitle: "", showIds: false },
    sections: [
      {
        id: "candidate",
        title: "Candidate",
        visible: true,
        columns: 2,
        fields: [
          slot("candidate_name", "Name"),
          slot("father_name", "Father's Name"),
          slot("class", "Class"),
          slot("sathii_key", "SATHII Key"),
          slot("exam_date", "Exam Date"),
          slot("exam_time", "Exam Time"),
          slot("exam_center", "Exam centre", 2),
        ],
      },
      { ...classicSections[1], visible: false, fields: [] },
      { ...classicSections[2], visible: false },
    ],
    photo: { enabled: true, widthMm: 30, heightMm: 38, position: "left", rounded: false, placeholderText: "paste your passport size color photo here" },
    code: { enabled: false, kind: "qr", data: "{{sathii_key}}", sizeMm: 16, label: "" },
    instructions: {
      enabled: true,
      placement: "front",
      title: "Important Instructions",
      items: [
        "This Admit Card is mandatory for entry to the examination centre.",
        "Valid School ID proof is needed.",
        "Bring a blue or black ball pen to the examination centre.",
        "Reach the examination centre at least 30 minutes before the exam time.",
        "Follow all the instructions given by the invigilator.",
        "Use of mobile phones and electronic devices is strictly prohibited.",
        "Any unfair means will lead to disqualification.",
      ],
      acknowledgement: "",
    },
    panel: {
      leftTagline: "S-CUBUS APTITUDE & TALENT HUNT\nFOR INQUISITIVE INDIVIDUALS",
      contactTitle: "For any query, please contact :",
      contactLines: [
        "3rd Floor, Plot No. 46, Block No. B",
        "Sector 12 Dwarka Delhi 110078",
        "",
        "Landmark : Opposite Bal Bhawan International School",
        "",
        "+91-8800166643 (SATHII HELPLINE)",
        "+91-8796101095, 011-46696001",
        "",
        "Web: www.sathii.scubus.com",
        "www.scubus.com",
      ],
      footerNote:
        "**To report any correction in the admit card** e.g., error in the spelling of student's name, etc, contact at given SATHII helpline number.",
      showCandidateSignatureBox: true,
    },
    filenamePattern: "SATHII_AdmitCard_{{sathii_key}}",
  };
}

export const TEMPLATE_PRESETS = [
  { id: "classic", name: "Classic Admit Card (A4)", build: defaultTemplate },
  { id: "sathii", name: "SATHII Exam Admit Card", build: sathiiTemplate },
] as const;

export const PAPER_SIZES: Record<"A4" | "Letter", { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  Letter: { w: 215.9, h: 279.4 },
};

/** Resolve the effective page width/height in mm. */
export function pageDims(t: TemplateConfig): { w: number; h: number } {
  if (t.page.preset === "custom") return { w: t.page.widthMm, h: t.page.heightMm };
  const p = PAPER_SIZES[t.page.preset];
  return t.page.orientation === "landscape" ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}

/**
 * Template used for individual per-candidate PDFs: exactly one card per file.
 * For multi-card layouts the page is cropped to a single card slot.
 */
export function singleCardTemplate(t: TemplateConfig): TemplateConfig {
  if (t.page.cardsPerPage === 1) return t;
  const { w } = pageDims(t);
  const { h } = cardDims(t);
  return {
    ...t,
    page: { ...t.page, preset: "custom", widthMm: w, heightMm: h + 2 * t.page.marginMm, cardsPerPage: 1 },
  };
}

/** Dimensions of a single card slot in mm. */
export function cardDims(t: TemplateConfig): { w: number; h: number } {
  const { w, h } = pageDims(t);
  const n = t.page.cardsPerPage;
  const m = t.page.marginMm;
  return { w: w - 2 * m, h: (h - 2 * m - (n - 1) * t.page.gapMm) / n };
}
