import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { AuthForm } from "@/components/app/auth-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return <AuthForm mode="login" allowSignup={env.allowSignup} showDemoHint={process.env.SHOW_DEMO_LOGIN === "true" || process.env.NODE_ENV !== "production"} />;
}
