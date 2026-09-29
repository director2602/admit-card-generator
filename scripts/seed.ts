// Creates a demo organisation + login (idempotent). Usage: npm run db:seed
import { eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import { createAccount } from "../src/lib/services/accounts";

async function main() {
  const email = (process.env.SEED_EMAIL ?? "demo@example.com").toLowerCase();
  const password = process.env.SEED_PASSWORD ?? "demo12345";
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (existing) {
    console.log(`Seed user ${email} already exists.`);
  } else {
    await createAccount({ orgName: process.env.SEED_ORG ?? "S-CUBUS Career Pvt. Ltd.", name: "Demo Admin", email, password });
    console.log(`Created seed user ${email} / ${password}`);
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
