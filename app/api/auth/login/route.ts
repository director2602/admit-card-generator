import { NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookie } from "@/lib/auth/session";
import { HttpError } from "@/lib/auth/http-error";
import { verifyLogin } from "@/lib/services/accounts";

const body = z.object({ email: z.string().max(200), password: z.string().max(200) });

// Basic in-memory brute-force protection (per IP + email). Use a shared store (e.g. Redis) when scaling out.
const attempts = new Map<string, { n: number; until: number }>();
const WINDOW = 15 * 60 * 1000;
const LIMIT = 10;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  let key = ip;
  try {
    const { email, password } = body.parse(await req.json());
    key = `${ip}|${email.toLowerCase()}`;
    const a = attempts.get(key);
    if (a && a.n >= LIMIT && a.until > Date.now()) {
      return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    }
    const user = await verifyLogin(email, password);
    attempts.delete(key);
    await setSessionCookie({ userId: user.id, orgId: user.orgId, email: user.email, name: user.name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) {
      const a = attempts.get(key);
      attempts.set(key, { n: (a && a.until > Date.now() ? a.n : 0) + 1, until: Date.now() + WINDOW });
    }
    const status = err instanceof HttpError ? err.status : 400;
    return NextResponse.json({ error: err instanceof HttpError ? err.message : "Invalid request" }, { status });
  }
}
