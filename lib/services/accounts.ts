import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { HttpError } from "@/lib/auth/http-error";
import { env } from "@/lib/env";
import { seedOrgTemplates } from "./templates";

export async function createAccount(input: { orgName: string; name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address");
  if (input.password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (exists) throw new HttpError(409, "An account with this email already exists");
  const passwordHash = await bcrypt.hash(input.password, 12);
  const { org, user } = await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(schema.organizations)
      .values({ name: input.orgName.trim().slice(0, 160) || "My Organisation", retentionDays: env.defaultRetentionDays })
      .returning();
    const [user] = await tx
      .insert(schema.users)
      .values({ orgId: org.id, email, name: input.name.trim().slice(0, 120) || email, passwordHash })
      .returning();
    return { org, user };
  });
  await seedOrgTemplates(org.id);
  return { org, user };
}

let dummyHash: string | undefined;

export async function verifyLogin(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  // Compare against a dummy hash when the user doesn't exist to keep timing uniform.
  dummyHash ??= await bcrypt.hash("timing-equaliser", 12);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !ok) throw new HttpError(401, "Incorrect email or password");
  return user;
}
