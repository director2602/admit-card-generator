"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Info } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DemoButton } from "@/components/app/demo-button";
import { jsonFetch } from "@/lib/utils";

export function CreateBatchForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader>
          <CardTitle>Step 1 · Examination batch</CardTitle>
          <CardDescription>Give the batch a name you will recognise later. Candidates from different batches never mix.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setBusy(true);
              try {
                const { batch } = await jsonFetch<{ batch: { id: string } }>("/api/batches", {
                  method: "POST",
                  json: { name: fd.get("name"), examName: fd.get("examName"), session: fd.get("session") },
                });
                router.push(`/batches/${batch.id}/setup?step=2`);
              } catch (err) {
                toast.error((err as Error).message);
                setBusy(false);
              }
            }}
          >
            <Field label="Batch name" htmlFor="name" className="sm:col-span-2" hint="e.g. “SATHII 2026 — Delhi centre, morning shift”">
              <Input id="name" name="name" required maxLength={160} placeholder="Batch name" />
            </Field>
            <Field label="Examination name" htmlFor="examName" hint="Used when the CSV has no exam name column.">
              <Input id="examName" name="examName" maxLength={200} placeholder="SATHII Scholarship Examination 2026" />
            </Field>
            <Field label="Academic year / session" htmlFor="session">
              <Input id="session" name="session" maxLength={100} placeholder="2026–27" />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" size="lg" disabled={busy}>
                {busy ? "Creating…" : "Create batch & continue"} <ArrowRight />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="h-fit bg-brand-soft/60">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-brand">
            <Info className="size-4" aria-hidden /> First time here?
          </div>
          <p className="text-sm text-muted-foreground">
            Load a ready-made batch of <b>100 fictional candidates</b> with the SATHII template to see the complete workflow — preview, generate
            and download — without using real student data.
          </p>
          <DemoButton className="w-full" label="Load demo batch" />
        </CardContent>
      </Card>
    </div>
  );
}
