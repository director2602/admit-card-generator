"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { HeroLogo } from "./logo";

export function AuthForm({ mode, allowSignup, showDemoHint = false }: { mode: "login" | "signup"; allowSignup: boolean; showDemoHint?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full bg-white/5" aria-hidden />
        <div className="pointer-events-none absolute -bottom-52 -left-32 size-[560px] rounded-full bg-accent/10" aria-hidden />
        <div className="relative text-sm font-semibold tracking-wide text-white/70">S-CUBUS AdmitDesk</div>
        <div className="relative flex flex-col items-start gap-8">
          <div className="rounded-2xl bg-white p-6 shadow-2xl">
            <HeroLogo className="h-56 w-auto" />
          </div>
          <div>
            <h2 className="max-w-md text-3xl font-extrabold leading-tight">Branded admit cards for every candidate — in minutes.</h2>
            <p className="mt-3 max-w-md text-white/75">Upload a CSV, design the card, and download print-ready PDFs for SATHII and every S-CUBUS examination.</p>
          </div>
        </div>
        <div className="relative text-xs text-white/50">© S-CUBUS Career Pvt. Ltd.</div>
      </section>
      <div className="flex items-center justify-center bg-[radial-gradient(900px_500px_at_80%_-10%,#f1e3f4_0%,transparent_60%)] px-4 py-10">
      <div className="w-full max-w-md">
        <HeroLogo className="mx-auto mb-8 h-36 w-auto lg:hidden" />
        <div className="rounded-xl border border-border bg-card p-7 shadow-[0_12px_40px_-12px_rgba(64,12,77,.28)]">
          <h1 className="text-xl font-extrabold tracking-tight">{mode === "login" ? "Sign in to your workspace" : "Create your organisation"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" ? "Generate branded admit cards for every candidate in minutes." : "Your data stays private to your organisation."}
          </p>
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            {mode === "signup" && (
              <>
                <Field label="Organisation name" htmlFor="orgName">
                  <Input id="orgName" name="orgName" required autoComplete="organization" placeholder="e.g. Springfield Examination Board" />
                </Field>
                <Field label="Your name" htmlFor="name">
                  <Input id="name" name="name" required autoComplete="name" />
                </Field>
              </>
            )}
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" required autoComplete="email" defaultValue={mode === "login" && showDemoHint ? "demo@example.com" : ""} />
            </Field>
            <Field label="Password" htmlFor="password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
              <Input id="password" name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </Field>
            {error && (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
          {mode === "login" && showDemoHint && (
            <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Local demo login: <b>demo@example.com</b> / <b>demo12345</b> (created by <code>npm run db:seed</code>).
            </p>
          )}
        </div>
        {allowSignup && (
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                New here? <Link className="font-semibold text-brand hover:underline" href="/signup">Create an organisation</Link>
              </>
            ) : (
              <>
                Already have an account? <Link className="font-semibold text-brand hover:underline" href="/login">Sign in</Link>
              </>
            )}
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
