import { NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookie } from "@/lib/auth/session";
import { HttpError } from "@/lib/auth/http-error";
import { createAccount } from "@/lib/services/accounts";
import { env } from "@/lib/env";

const body = z.object({
  orgName: z.string().min(2).max(160),
  name: z.string().min(1).max(120),
  email: z.string().max(200),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  if (!env.allowSignup) return NextResponse.json({ error: "Sign-up is disabled" }, { status: 403 });
  try {
    const input = body.parse(await req.json());
    const { user } = await createAccount(input);
    await setSessionCookie({ userId: user.id, orgId: user.orgId, email: user.email, name: user.name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Please fill in all fields (password: 8+ characters)." }, { status: 400 });
  }
}
