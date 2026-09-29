import { SignJWT, jwtVerify } from "jose";
import { requireSecret } from "@/lib/env";

export const SESSION_COOKIE = "acg_session";
export const MAX_AGE = 60 * 60 * 24 * 7;

export interface Session {
  userId: string;
  orgId: string;
  email: string;
  name: string;
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ org: s.orgId, email: s.email, name: s.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(requireSecret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, requireSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.org !== "string") return null;
    return {
      userId: payload.sub,
      orgId: payload.org,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}

