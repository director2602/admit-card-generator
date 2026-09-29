import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/lib/auth/session";
import { createTemplate, listTemplates, seedOrgTemplates } from "@/lib/services/templates";
import { TEMPLATE_PRESETS } from "@/lib/template/defaults";

export const GET = api(async (_req, s) => {
  await seedOrgTemplates(s.orgId);
  return NextResponse.json({ templates: await listTemplates(s.orgId) });
});

const body = z.object({ name: z.string().max(120), preset: z.enum(["classic", "sathii"]).optional(), config: z.unknown().optional() });

export const POST = api(async (req, s) => {
  const { name, preset, config } = body.parse(await req.json());
  const cfg = config ?? (preset ? TEMPLATE_PRESETS.find((p) => p.id === preset)!.build() : undefined);
  const t = await createTemplate(s.orgId, name, cfg);
  return NextResponse.json({ template: t }, { status: 201 });
});
