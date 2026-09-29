import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { HttpError } from "./http-error";
import { SESSION_COOKIE, MAX_AGE, signSession, verifySession, type Session } from "./jwt";
export { SESSION_COOKIE, signSession, verifySession, type Session };

export async function setSessionCookie(s: Session) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** For server components / pages. */
export async function requirePageSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export { HttpError };

/** Wrap a route handler: authenticates and converts errors into JSON responses without leaking internals. */
export function api<C>(handler: (req: Request, session: Session, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    try {
      return await handler(req, session, ctx);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err && typeof err === "object" && "issues" in err) {
        return NextResponse.json({ error: "Invalid input", issues: (err as { issues: unknown }).issues }, { status: 400 });
      }
      console.error(JSON.stringify({ level: "error", event: "api.unhandled", path: new URL(req.url).pathname, error: String(err) }));
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}
