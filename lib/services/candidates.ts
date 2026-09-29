import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { HttpError } from "@/lib/auth/http-error";

export interface CandidateQuery {
  batchId?: string;
  status?: string; // valid | invalid | duplicate | done | failed | pending | flagged
  exam?: string;
  q?: string;
  sort?: "row" | "name" | "roll" | "status" | "generated";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export async function queryCandidates(orgId: string, q: CandidateQuery) {
  const conds: SQL[] = [eq(schema.candidates.orgId, orgId)];
  if (q.batchId && /^[0-9a-f-]{36}$/.test(q.batchId)) conds.push(eq(schema.candidates.batchId, q.batchId));
  if (q.exam) conds.push(eq(schema.candidates.examName, q.exam));
  switch (q.status) {
    case "valid":
    case "invalid":
    case "duplicate":
      conds.push(eq(schema.candidates.recordStatus, q.status));
      break;
    case "flagged":
      conds.push(eq(schema.candidates.flagged, true));
      break;
    case "done":
    case "failed":
    case "pending":
      conds.push(eq(schema.candidates.genStatus, q.status), eq(schema.candidates.recordStatus, "valid"));
      break;
    case "in_progress":
      conds.push(inArray(schema.candidates.genStatus, ["queued", "processing"]));
      break;
  }
  if (q.q?.trim()) {
    const term = `%${q.q.trim().replace(/[%_\\]/g, (m) => `\\${m}`).slice(0, 100)}%`;
    conds.push(
      or(
        ilike(schema.candidates.name, term),
        ilike(schema.candidates.rollNumber, term),
        ilike(schema.candidates.applicationNumber, term),
      )!,
    );
  }
  const where = and(...conds);
  const dirFn = q.dir === "desc" ? desc : asc;
  const sortCol =
    q.sort === "name"
      ? sql`lower(${schema.candidates.name})`
      : q.sort === "roll"
        ? schema.candidates.rollNumber
        : q.sort === "status"
          ? schema.candidates.genStatus
          : q.sort === "generated"
            ? schema.candidates.generatedAt
            : schema.candidates.rowNumber;
  const pageSize = Math.min(Math.max(q.pageSize ?? 25, 5), 200);
  const page = Math.max(q.page ?? 1, 1);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.candidates).where(where);
  const rows = await db
    .select({
      id: schema.candidates.id,
      batchId: schema.candidates.batchId,
      batchName: schema.batches.name,
      rowNumber: schema.candidates.rowNumber,
      name: schema.candidates.name,
      rollNumber: schema.candidates.rollNumber,
      applicationNumber: schema.candidates.applicationNumber,
      examName: schema.candidates.examName,
      recordStatus: schema.candidates.recordStatus,
      flagged: schema.candidates.flagged,
      genStatus: schema.candidates.genStatus,
      genError: schema.candidates.genError,
      errors: schema.candidates.errors,
      fileName: schema.candidates.fileName,
      generatedAt: schema.candidates.generatedAt,
    })
    .from(schema.candidates)
    .innerJoin(schema.batches, eq(schema.batches.id, schema.candidates.batchId))
    .where(where)
    .orderBy(dirFn(sortCol), asc(schema.candidates.rowNumber))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { rows, total: count, page, pageSize };
}

export async function getCandidate(orgId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "Candidate not found");
  const [c] = await db
    .select()
    .from(schema.candidates)
    .where(and(eq(schema.candidates.id, id), eq(schema.candidates.orgId, orgId)));
  if (!c) throw new HttpError(404, "Candidate not found");
  return c;
}

export async function examNames(orgId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ exam: schema.candidates.examName })
    .from(schema.candidates)
    .where(eq(schema.candidates.orgId, orgId));
  return rows.map((r) => r.exam).filter(Boolean).sort();
}
