/* eslint-disable @typescript-eslint/no-explicit-any -- untyped JSON responses in a test script */
/**
 * End-to-end acceptance test against a running server (default http://localhost:3000).
 * Usage: npm run e2e  (requires the seed user: npm run db:seed)
 *
 * Covers: login, batch creation, CSV import with invalid rows, logo upload + branding,
 * preview, bulk generation of 100 PDFs, ZIP + manifest, combined PDF, search + single
 * download, error report, retry of failed records, and cross-organisation isolation.
 */
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { autoMap } from "../src/lib/fields";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve(process.env.E2E_OUT ?? "e2e-output");
let failures = 0;

function check(cond: unknown, msg: string) {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
}

class Client {
  cookie = "";
  async req(p: string, init: RequestInit & { json?: unknown } = {}) {
    const { json, ...rest } = init;
    const res = await fetch(BASE + p, {
      ...rest,
      redirect: "manual",
      headers: { cookie: this.cookie, ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    return res;
  }
  async json<T = any>(p: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
    const r = await this.req(p, init);
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${init.method ?? "GET"} ${p} -> ${r.status} ${JSON.stringify(body)}`);
    return body as T;
  }
}

async function waitForJob(c: Client, batchId: string, timeoutMs = 300_000) {
  const t0 = Date.now();
  for (;;) {
    const s = await c.json(`/api/batches/${batchId}/status`);
    if (s.job && !["queued", "running"].includes(s.job.status)) return s;
    if (Date.now() - t0 > timeoutMs) throw new Error("Timed out waiting for generation");
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const c = new Client();

  console.log("1. Sign in");
  await c.json("/api/auth/login", { method: "POST", json: { email: process.env.SEED_EMAIL ?? "demo@example.com", password: process.env.SEED_PASSWORD ?? "demo12345" } });
  check(c.cookie.startsWith("acg_session="), "session cookie issued");
  check((await c.req("/api/batches", { headers: { cookie: "" } })).status === 401, "API rejects unauthenticated requests");

  console.log("2. Create examination batch");
  const { batch } = await c.json("/api/batches", { method: "POST", json: { name: `E2E ${new Date().toISOString()}`, examName: "SATHII Scholarship Examination 2026", session: "2026–27" } });
  check(batch.id, `batch created (${batch.id})`);

  console.log("3. Upload CSV with 100 fictional candidates (+3 problem rows)");
  const csv = fs.readFileSync("public/samples/demo-candidates-100.csv", "utf8");
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  check(rows.length === 100, `parsed ${rows.length} rows`);
  const bad = [
    { ...rows[0], "Student Name": "", "Roll No": "SAT26BAD1" },
    { ...rows[1], DOB: "31-02-2011", "Roll No": "SAT26BAD2" },
    { ...rows[2], "Application ID": "APP-DUP" }, // duplicate roll number of row 3
  ];
  const allRows = [...rows, ...bad];
  const mapping = autoMap(parsed.meta.fields ?? []);
  check(mapping.fields.candidate_name.type === "column" && mapping.fields.roll_number.type === "column", "columns auto-mapped (name, roll number)");
  check(mapping.customFields.some((f) => f.key === "class") && mapping.customFields.some((f) => f.key === "sathii_key"), "custom fields detected (class, sathii_key)");
  const imp = await c.json(`/api/batches/${batch.id}/import`, {
    method: "POST",
    json: { rows: allRows, mapping, policy: "skip", resolutions: {}, fileName: "demo-candidates-100.csv", fileSize: csv.length, mode: "replace" },
  });
  check(imp.summary.valid === 100, `100 valid records (got ${imp.summary.valid})`);
  check(imp.summary.invalid === 2 && imp.summary.duplicates === 1, `invalid rows reported without failing batch (invalid=${imp.summary.invalid}, dup=${imp.summary.duplicates})`);

  console.log("4. Upload logo + customise branding");
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync("assets/builtin/sathii-logo.png")], { type: "image/png" }), "logo.png");
  fd.append("kind", "logo");
  const logo = await c.json("/api/assets", { method: "POST", body: fd });
  check(logo.ref?.startsWith("asset:"), "logo uploaded");
  const bogus = new FormData();
  bogus.append("file", new Blob(["<svg onload=alert(1)>"], { type: "image/png" }), "evil.png");
  bogus.append("kind", "logo");
  check((await c.req("/api/assets", { method: "POST", body: bogus })).status === 415, "non-image upload rejected by magic-byte check");
  const { template } = await c.json("/api/templates", { method: "POST", json: { name: "E2E SATHII", preset: "sathii" } });
  template.config.branding.logo = logo.ref;
  template.config.branding.primary = "#3f0c47";
  await c.json(`/api/templates/${template.id}`, { method: "PATCH", json: { config: template.config } });
  await c.json(`/api/batches/${batch.id}/template`, { method: "POST", json: { templateId: template.id } });
  check(true, "template customised and applied");

  console.log("5. Preview a fully populated card");
  const prev = await c.req("/api/preview", { method: "POST", json: { batchId: batch.id } });
  const html = await prev.text();
  check(prev.ok && html.includes(rows[0]["Student Name"]) && html.includes(rows[0]["SATHII Key"]), "preview contains first candidate's data");
  fs.writeFileSync(path.join(OUT, "preview.html"), html);

  console.log("6. Generate 100 PDFs");
  const t0 = Date.now();
  await c.json(`/api/batches/${batch.id}/generate`, { method: "POST", json: { mode: "pending" } });
  const dup = await c.req(`/api/batches/${batch.id}/generate`, { method: "POST", json: { mode: "pending" } });
  check(dup.status === 409, `duplicate job prevented (${dup.status})`);
  const st = await waitForJob(c, batch.id);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  check(st.stats.generated === 100 && st.stats.failed === 0, `100 generated, 0 failed in ${secs}s (got ${st.stats.generated}/${st.stats.failed})`);

  console.log("7. Download ZIP with manifest");
  const zr = await c.req(`/api/batches/${batch.id}/zip`);
  const zbuf = Buffer.from(await zr.arrayBuffer());
  fs.writeFileSync(path.join(OUT, "batch.zip"), zbuf);
  const zip = await JSZip.loadAsync(zbuf);
  const pdfs = Object.keys(zip.files).filter((n) => n.endsWith(".pdf"));
  check(pdfs.length === 100, `ZIP contains ${pdfs.length} PDFs`);
  const manifest = await zip.file("manifest.csv")?.async("string");
  check(manifest && manifest.split("\n").filter(Boolean).length === 104, "manifest.csv lists all 103 rows + header");
  const firstPdf = await zip.file(pdfs[0])!.async("nodebuffer");
  check(firstPdf.subarray(0, 5).toString() === "%PDF-", `ZIP entries are real PDFs (${pdfs[0]})`);
  check(pdfs.every((n) => /^admit-cards\/SATHII_AdmitCard_SAT26-\d+[FJN]-\d+\.pdf$/.test(n)), "filenames follow pattern SATHII_AdmitCard_{{sathii_key}}.pdf");

  console.log("8. Combined PDF");
  const cr = await c.req(`/api/batches/${batch.id}/combined?sort=roll`);
  const cbuf = Buffer.from(await cr.arrayBuffer());
  fs.writeFileSync(path.join(OUT, "combined.pdf"), cbuf);
  const doc = await PDFDocument.load(cbuf);
  const page = doc.getPage(0).getSize();
  check(doc.getPageCount() === 100, `combined PDF has ${doc.getPageCount()} pages`);
  check(Math.abs(page.width / 72 * 25.4 - 260) < 1 && Math.abs(page.height / 72 * 25.4 - 106) < 1, `page size ${(page.width / 72 * 25.4).toFixed(1)}×${(page.height / 72 * 25.4).toFixed(1)} mm matches template`);

  console.log("9. Search + single download");
  const target = rows[41];
  const found = await c.json(`/api/candidates?q=${encodeURIComponent(target["Roll No"])}&batchId=${batch.id}`);
  check(found.total === 1 && found.rows[0].name === target["Student Name"], `search by roll number finds ${target["Student Name"]}`);
  const byName = await c.json(`/api/candidates?q=${encodeURIComponent(target["Student Name"].split(" ")[0])}&batchId=${batch.id}`);
  check(byName.total >= 1, "search by name works");
  const one = await c.req(`/api/candidates/${found.rows[0].id}/pdf`);
  const oneBuf = Buffer.from(await one.arrayBuffer());
  fs.writeFileSync(path.join(OUT, "single.pdf"), oneBuf);
  check(one.ok && oneBuf.subarray(0, 5).toString() === "%PDF-" && /attachment/.test(one.headers.get("content-disposition") ?? ""), "single PDF downloads");

  console.log("10. Error report");
  const er = await (await c.req(`/api/batches/${batch.id}/errors`)).text();
  check(er.includes("SAT26BAD1") && er.includes("SAT26BAD2") && er.includes("Duplicate"), "error report lists invalid + duplicate rows");

  console.log("11. Failure + retry without regenerating successes");
  const { batch: b2 } = await c.json("/api/batches", { method: "POST", json: { name: "E2E retry", examName: "Retry test" } });
  const small = rows.slice(0, 3).map((r, i) => ({ ...r, Photo: i === 1 ? "missing_photo.png" : r.Photo }));
  await c.json(`/api/batches/${b2.id}/import`, { method: "POST", json: { rows: small, mapping, policy: "skip", resolutions: {}, fileName: "small.csv", fileSize: 1, mode: "replace" } });
  await c.json(`/api/batches/${b2.id}/template`, { method: "POST", json: { templateId: template.id } });
  await c.json(`/api/batches/${b2.id}/generate`, { method: "POST", json: {} });
  let s2 = await waitForJob(c, b2.id);
  check(s2.stats.generated === 2 && s2.stats.failed === 1, `missing photo fails only that record (${s2.stats.generated} ok / ${s2.stats.failed} failed)`);
  const before = await c.json(`/api/candidates?batchId=${b2.id}&status=done`);
  const beforeIds = before.rows.map((r: any) => r.id).sort();
  const pfd = new FormData();
  pfd.append("files", new Blob([fs.readFileSync("assets/builtin/scubus-logo.png")], { type: "image/png" }), "missing_photo.png");
  await c.json(`/api/batches/${b2.id}/photos`, { method: "POST", body: pfd });
  const firstGen = await c.json(`/api/candidates/${beforeIds[0]}`);
  await c.json(`/api/batches/${b2.id}/generate`, { method: "POST", json: { mode: "failed" } });
  s2 = await waitForJob(c, b2.id);
  const afterGen = await c.json(`/api/candidates/${beforeIds[0]}`);
  check(s2.stats.generated === 3 && s2.stats.failed === 0, "retry generated the failed record");
  check(firstGen.candidate.generatedAt === afterGen.candidate.generatedAt, "successful records were not regenerated");

  console.log("12. Organisation isolation");
  const other = new Client();
  await other.json("/api/auth/signup", { method: "POST", json: { orgName: "Other Org", name: "Eve", email: `eve+${Date.now()}@example.com`, password: "password123" } });
  check((await other.req(`/api/candidates/${found.rows[0].id}/pdf`)).status === 404, "other org cannot download candidate PDF");
  check((await other.req(`/api/batches/${batch.id}/zip`)).status === 404, "other org cannot download batch ZIP");
  check((await other.req(`/api/assets/${logo.id}`)).status === 404, "other org cannot read uploaded logo");
  const otherList = await other.json(`/api/candidates?q=SAT26`);
  check(otherList.total === 0, "other org sees no candidates");

  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll acceptance checks passed ✔");
  console.log(`Artifacts written to ${OUT}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
