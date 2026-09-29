# AdmitDesk — Bulk Admit Card Generator

Generate hundreds or thousands of branded, print-ready admit cards from a CSV file. Candidates are uploaded, mapped and validated. You design the card in a visual editor, then the server renders one real PDF per candidate. You can download them one at a time, as a ZIP with a manifest, or as a single combined PDF.

It ships with two designs:

- **Classic Admit Card (A4)**: header band, candidate and exam details, photo, QR code, signature areas and instructions.
- **SATHII Exam Admit Card**: the three-panel landscape design used by S-CUBUS for the SATHII exam (logos left and right, details in a purple centre panel, instructions, correction note and helpline panel). The SATHII and S-CUBUS logos in `assets/builtin/` were cropped from the reference card. Upload higher-resolution files in **Templates & Branding** for sharper print output.

## Quick start (local)

Requirements: Node.js 20.9+ (22 recommended), PostgreSQL 14+, and Chrome or Chromium. Chromium is auto-detected; otherwise set `CHROMIUM_PATH`.

```bash
npm install                      # also copies the bundled PDF fonts (postinstall)
cp .env.example .env             # then set DATABASE_URL and AUTH_SECRET (openssl rand -hex 32)
createdb admitcard               # or use docker compose up db
npm run db:migrate               # applies SQL migrations in ./drizzle
npm run db:seed                  # demo login: demo@example.com / demo12345
npm run dev                      # http://localhost:3000
```

Sign in, then click **Try with 100 demo candidates**. This creates a batch of fictional candidates paired with the SATHII template and takes you straight to the preview, generate and download steps.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run db:generate` | Create a new SQL migration after editing `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Create the demo organisation and user (idempotent) |
| `npm run samples` | Regenerate the sample CSVs in `public/samples` |
| `npm run worker` | Standalone generation worker (for `WORKER_MODE=external`) |
| `npm run e2e` | End-to-end acceptance test against a running server |
| `npm run typecheck` / `npm run lint` | Static checks |

## Environment variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | | PostgreSQL connection string |
| `AUTH_SECRET` | yes | | 32+ random characters; signs session cookies |
| `ALLOW_SIGNUP` | | `true` | Allow new organisations to self-register |
| `STORAGE_DRIVER` | | `local` | `local` or `s3` |
| `LOCAL_STORAGE_DIR` | | `./storage` | Outside `public/`, so files are never directly reachable |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | for S3 | | Any S3-compatible store (AWS, R2, MinIO…) |
| `CHROMIUM_PATH` | | auto | Chrome/Chromium binary used for PDFs |
| `PDF_CONCURRENCY` | | `4` | Parallel Chromium pages |
| `JOB_CHUNK_SIZE` | | `25` | Candidates claimed per chunk |
| `WORKER_MODE` | | `inline` | `inline` runs jobs inside the web server; `external` runs them in `npm run worker` |
| `MAX_CSV_MB`, `MAX_CSV_ROWS`, `MAX_IMAGE_MB`, `MAX_PHOTO_ZIP_MB` | | 10 / 20000 / 2 / 200 | Upload limits |
| `ALLOW_REMOTE_PHOTOS` | | `true` | Allow `https://` photo URLs in the CSV (public hosts only) |
| `DEFAULT_RETENTION_DAYS` | | `30` | Default retention for new organisations |
| `SHOW_DEMO_LOGIN` | | `false` | Show the demo credentials hint on the login page in production |
| `INSECURE_COOKIES` | | | Set `true` only when serving production over plain HTTP |

## The workflow

1. **Create batch**: one batch per examination, so data never mixes between exams.
2. **Upload CSV**: drag and drop or pick a file. UTF-8, UTF-16 and Windows-1252 are handled, and the file name, size and record count are shown. The sample files include a blank template, 10 samples, 100 demo candidates and a sample with invalid rows.
3. **Map & validate**: columns are auto-mapped using header aliases. Any field can instead take a fixed value (for example the same exam centre for everyone). Custom fields are supported, and mappings can be saved as reusable presets. Rows are validated for required fields, dates, times and photo references. Duplicate roll or application numbers can be skipped, flagged, or resolved manually. The preview table shows problem rows, and a downloadable error report is available. If photos are file names, you can upload images or a ZIP of images, matched by file name.
4. **Template & branding**: a visual editor with logo, secondary logo, colours, font, size, header style, border, corner radius, watermark (image or text) and background image. Page settings cover A4, Letter or custom size, orientation, margins and 1–4 cards per page. Sections and fields can be reordered (drag and drop or arrow buttons), relabelled, resized, aligned, bolded or hidden. Other settings: photo size and position, QR code or Code 128 barcode with `{{token}}` data, authority signature, seal, signatory, instructions (front or separate back page), filename pattern and date format. Templates can be saved, duplicated, renamed or reset. The live preview uses the same renderer as the PDFs.
5. **Preview** the first three real candidates.
6. **Generate**: a background job shows live progress, counts, estimated time left and a cancel button. You can retry only the failed records or regenerate everything.
7. **Download**: a ZIP of individual PDFs plus `manifest.csv`, a combined PDF (sorted by roll number, name or CSV order), a print view, per-candidate search, preview and download, and a ZIP or combined PDF of just the selected candidates.

To fix mistakes after generating, use **Upload corrected CSV** on a batch. Rows are matched by roll number, and only new or changed rows are regenerated.

## Architecture

```
src/
  app/
    (auth)/login, signup           sign-in / organisation sign-up
    (app)/                         dashboard, create, batches, batches/[id], batches/[id]/setup (wizard),
                                   templates, templates/[id] (designer), candidates, settings
    api/                           route handlers (auth, batches, import, photos, template, generate,
                                   status, zip, combined, errors, candidates, preview, templates,
                                   assets, mapping-presets, settings, demo, fonts, builtin)
  proxy.ts                         auth gate for pages and APIs (Next 16 "proxy", formerly middleware)
  instrumentation.ts               starts the inline worker + hourly retention purge
  components/ui                    shadcn-style primitives (Radix + Tailwind + cva)
  components/{wizard,templates,batch,settings,app}   feature UI
  lib/
    fields.ts                      standard field registry, auto-mapping
    csv/                           parsing (Papa Parse, encoding detection) + isomorphic validation
    template/                      config types, zod schema, default + SATHII presets, page math
    render/                        pure HTML card renderer, fonts, QR/barcode, image resolution
    pdf/browser.ts                 Chromium page pool (puppeteer-core), network-blocked rendering
    jobs/engine.ts                 DB-backed job queue, chunked + resumable generation
    services/                      batches, candidates, templates, assets, outputs (ZIP/combined), retention
    storage/                       local and S3 drivers behind one interface
    security/                      sanitising, CSV-injection guard, image sniffing, SSRF-safe fetch
    auth/                          JWT session cookies, API wrapper
drizzle/                           SQL migrations
scripts/                           migrate, seed, worker, samples, e2e, copy-fonts
assets/                            bundled fonts (for PDFs) and built-in logos
```

**Rendering.** A single pure function (`lib/render/card.ts`) produces the HTML for a card. Physical units (mm and pt) are used throughout, and an `@page` rule sets the exact paper size. The same markup drives the editor preview (in a script-less sandboxed iframe), the print view and Puppeteer's `page.pdf({ preferCSSPageSize: true })`. Fonts and images are inlined as data URIs, and every network request from the rendering page is blocked.

**Bulk engine.** `POST /generate` records a job and marks target candidates `queued`, then returns immediately. The worker claims chunks with `FOR UPDATE SKIP LOCKED` and renders them through a bounded Chromium page pool. Each PDF is written to storage before the next chunk starts. A partial unique index allows only one active job per batch. Retrying touches only `failed` or `pending` rows. Cancelling finishes in-flight cards and returns the rest to `pending`. Jobs whose heartbeat stops are resumed on restart. The ZIP is streamed entry by entry. The combined PDF merges the already-rendered files with pdf-lib, or re-renders in chunks for multi-card pages, and is cached until something is regenerated.

Measured in this environment: **100 PDFs in about 6 seconds** with 4 parallel renders.

## Security and privacy

- Organisation scoping: every query filters by the session's `orgId`, and cross-organisation access returns 404. The e2e test checks this.
- HTTP-only, SameSite=Lax, signed (HS256) session cookies. Passwords are hashed with bcrypt (cost 12). Login attempts are rate-limited.
- No public file URLs. PDFs, photos and logos are streamed only through authenticated route handlers with `Cache-Control: private, no-store`. Local storage sits outside `public/`.
- Uploads: images are identified by magic bytes (PNG, JPEG, WebP only; SVG is rejected) and size-limited. Candidate CSV files are limited in size and row count. Storage keys are server-generated and validated, which prevents path traversal. Download filenames are sanitised.
- CSV input is cleaned (control characters stripped, lengths bounded) and validated with zod on the server. Every exported CSV (manifest, error reports) is protected against spreadsheet formula injection.
- All user text is HTML-escaped in the renderer. The preview is served with a strict CSP inside a script-less sandboxed iframe.
- Remote photo URLs are fetched server-side with SSRF protection: private and loopback addresses are blocked, every redirect is re-checked, and there are timeouts and size caps.
- Retention: each batch gets an expiry date from the organisation's retention setting. Expired batches (records, photos, PDFs) are purged hourly, or on demand from Settings. Deleting a batch removes all of its files.
- Logs contain identifiers and counts only, never names, dates of birth or records. Secrets come from environment variables.

### Limitations of a local or development deployment

- Files are stored unencrypted on local disk. Use S3 with server-side encryption (enabled by the S3 driver) and disk encryption in production.
- Served over plain HTTP in development, so session cookies are not `Secure`. Always put production behind HTTPS.
- The login rate limiter and the inline worker are per-process. For several web instances, use `WORKER_MODE=external` with one or more `npm run worker` processes, shared S3 storage and a shared rate-limit store.
- The SSRF guard resolves DNS before fetching, but a DNS-rebinding race is still theoretically possible. Set `ALLOW_REMOTE_PHOTOS=false` and upload photos instead if that matters to you.

## Deployment

**Docker:** `AUTH_SECRET=$(openssl rand -hex 32) docker compose up --build`. The image installs Chromium and Noto fonts, runs migrations on start, and serves on port 3000.

**Any Node host (Render, Railway, a VM…):** provision PostgreSQL, set the environment variables above, make sure Chromium is installed (or point `CHROMIUM_PATH` at it), then run `npm ci && npm run build`, `npm run db:migrate` and `npm start`. Serverless platforms with short request timeouts and no persistent processes are not a good fit for the inline worker. Use a long-running service, or a separate worker service with `WORKER_MODE=external`.

## Engineering decisions and known limitations

- **Drizzle ORM instead of Prisma.** The build sandbox blocks Prisma's engine binary downloads (`binaries.prisma.sh`). Drizzle is pure TypeScript, uses the same PostgreSQL schema and SQL migrations, and has no native binaries to fetch. That also makes containers and locked-down CI simpler.
- **shadcn/ui components are vendored.** The shadcn registry was unreachable here, so the components in `src/components/ui` are written in the shadcn style (Radix primitives, Tailwind and cva) and are drop-in compatible.
- The template editor uses an ordered section and field layout editor (drag and drop plus keyboard-accessible buttons, spans, alignment) rather than free x/y positioning. This keeps every card consistent even when a candidate's data is long or missing.
- Empty fields are hidden, so no blank labels are printed. Cards that must be filled in by hand would need a small renderer option to keep empty labels.
- The combined PDF is built on request. For 1,000 one-per-page cards this is a fast merge. Multi-card-per-page layouts re-render, so allow a little longer for very large batches.
- Remote photo URLs are fetched during generation. Very slow image hosts will slow the job down; uploading a ZIP of photos is faster and more reliable.
- Hindi names render with the bundled Noto Sans Devanagari font. Other scripts fall back to the fonts installed on the server.
