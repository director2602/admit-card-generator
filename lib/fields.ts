/**
 * Field registry shared by the CSV importer, validator, template editor and renderer.
 * Isomorphic: safe to import from client and server code.
 */

export type FieldKind = "text" | "date" | "time" | "photo" | "image" | "gender" | "code";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** Header aliases used to auto-map CSV columns (lowercase, alphanumerics only). */
  aliases: string[];
  hint?: string;
}

export const STANDARD_FIELDS: FieldDef[] = [
  { key: "candidate_name", label: "Candidate Name", kind: "text", required: true, aliases: ["name", "candidatename", "studentname", "fullname", "candidate"] },
  { key: "roll_number", label: "Roll Number", kind: "text", required: true, aliases: ["rollno", "rollnumber", "roll", "rollnum", "seatno", "hallticketno"] },
  { key: "application_number", label: "Application Number", kind: "text", aliases: ["applicationno", "applicationnumber", "appno", "applicationid", "formno"] },
  { key: "registration_number", label: "Registration / Candidate ID", kind: "text", aliases: ["registrationno", "registrationnumber", "regno", "candidateid", "studentid", "enrollmentno"] },
  { key: "father_name", label: "Father's / Guardian's Name", kind: "text", aliases: ["fathername", "fathersname", "guardianname", "parentname", "father"] },
  { key: "date_of_birth", label: "Date of Birth", kind: "date", aliases: ["dob", "dateofbirth", "birthdate"] },
  { key: "gender", label: "Gender", kind: "gender", aliases: ["gender", "sex"] },
  { key: "category", label: "Candidate Category", kind: "text", aliases: ["category", "candidatecategory", "caste", "quota"] },
  { key: "photo", label: "Photograph (URL or filename)", kind: "photo", aliases: ["photo", "photograph", "photourl", "photofile", "image", "picture"] },
  { key: "signature", label: "Signature (URL or filename)", kind: "image", aliases: ["signature", "sign", "signatureurl", "signaturefile"] },
  { key: "exam_name", label: "Exam Name", kind: "text", aliases: ["examname", "exam", "examination", "test", "testname"] },
  { key: "exam_date", label: "Exam Date", kind: "date", aliases: ["examdate", "dateofexam", "testdate", "date"] },
  { key: "exam_time", label: "Exam Time", kind: "time", aliases: ["examtime", "time", "timing", "testtime"] },
  { key: "reporting_time", label: "Reporting Time", kind: "time", aliases: ["reportingtime", "reporting", "reportby"] },
  { key: "gate_closing_time", label: "Gate Closing Time", kind: "time", aliases: ["gateclosingtime", "gateclose", "gateclosing", "entryclosetime"] },
  { key: "exam_duration", label: "Exam Duration", kind: "text", aliases: ["duration", "examduration"] },
  { key: "shift", label: "Shift / Session", kind: "text", aliases: ["shift", "session", "slot", "batch"] },
  { key: "exam_center", label: "Exam Center", kind: "text", aliases: ["examcenter", "examcentre", "center", "centre", "venue", "centername", "centrename"] },
  { key: "center_address", label: "Center Address", kind: "text", aliases: ["centeraddress", "centreaddress", "address", "venueaddress"] },
  { key: "qr_data", label: "QR Code Data", kind: "code", aliases: ["qr", "qrdata", "qrcode", "barcode"] },
];

export const STANDARD_FIELD_KEYS = STANDARD_FIELDS.map((f) => f.key);

export type MappingSource =
  | { type: "column"; column: string }
  | { type: "constant"; value: string }
  | { type: "none" };

export interface CustomFieldDef {
  key: string;
  label: string;
  required?: boolean;
}

export interface FieldMapping {
  fields: Record<string, MappingSource>;
  customFields: CustomFieldDef[];
  /** Standard fields the organisation wants to treat as required in addition to the defaults. */
  extraRequired?: string[];
}

export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function slugKey(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return s || "field";
}

/** Guess a mapping from CSV headers. */
export function autoMap(headers: string[]): FieldMapping {
  const fields: Record<string, MappingSource> = {};
  const used = new Set<string>();
  const norm = headers.map((h) => ({ h, n: normalizeHeader(h) }));
  for (const def of STANDARD_FIELDS) {
    const candidates = [normalizeHeader(def.key), ...def.aliases];
    const hit = norm.find((x) => !used.has(x.h) && candidates.includes(x.n));
    if (hit) {
      fields[def.key] = { type: "column", column: hit.h };
      used.add(hit.h);
    } else {
      fields[def.key] = { type: "none" };
    }
  }
  // Remaining columns become custom fields automatically.
  const customFields: CustomFieldDef[] = [];
  const taken = new Set(STANDARD_FIELD_KEYS);
  for (const { h } of norm) {
    if (used.has(h) || !h.trim()) continue;
    let key = slugKey(h);
    while (taken.has(key)) key = `${key}_x`;
    taken.add(key);
    customFields.push({ key, label: h.trim() });
    fields[key] = { type: "column", column: h };
  }
  return { fields, customFields };
}

export function fieldLabel(key: string, mapping?: FieldMapping | null): string {
  const std = STANDARD_FIELDS.find((f) => f.key === key);
  if (std) return std.label;
  const c = mapping?.customFields.find((f) => f.key === key);
  return c?.label ?? key;
}

export function allFieldKeys(mapping?: FieldMapping | null): string[] {
  return [...STANDARD_FIELD_KEYS, ...(mapping?.customFields.map((c) => c.key) ?? [])];
}
