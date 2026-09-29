import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { AuthForm } from "@/components/app/auth-form";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getSession()) redirect("/");
  if (!env.allowSignup) redirect("/login");
  return <AuthForm mode="signup" allowSignup />;
}
