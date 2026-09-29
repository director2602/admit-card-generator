"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { jsonFetch } from "@/lib/utils";

export function SettingsForm({
  org,
  user,
  presets,
  system,
}: {
  org: { name: string; retentionDays: number };
  user: { name: string; email: string };
  presets: { id: string; name: string }[];
  system: { storage: string; worker: string; concurrency: number; chromium: boolean; remotePhotos: boolean; maxImageMb: number };
}) {
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [days, setDays] = useState(org.retentionDays);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await jsonFetch("/api/settings", { method: "PATCH", json: { name, retentionDays: days } });
      toast.success("Settings saved");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Organisation</CardTitle>
          <CardDescription>
            Signed in as {user.name} ({user.email}). All records are private to this organisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Organisation name" htmlFor="on">
            <Input id="on" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Data retention (days)" htmlFor="rd" hint="Batches — candidate records, photos and PDFs — are deleted automatically this many days after creation.">
            <Input id="rd" type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Number(e.target.value))} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save settings"}
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="outline" className="text-danger">
                  <Trash2 /> Purge expired data now
                </Button>
              }
              title="Delete all expired batches now?"
              description="Batches past their retention date are permanently deleted, including their PDFs and photos."
              confirmLabel="Purge now"
              onConfirm={async () => {
                const r = await jsonFetch<{ deleted: number }>("/api/settings/purge", { method: "POST" });
                toast.success(`${r.deleted} expired batch(es) deleted`);
                router.refresh();
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved column mappings</CardTitle>
          <CardDescription>Reuse mappings for CSVs exported from the same system.</CardDescription>
        </CardHeader>
        <CardContent>
          {presets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved mappings yet. Use “Save mapping” in the mapping step.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {presets.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  {p.name}
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`}>
                        <Trash2 />
                      </Button>
                    }
                    title={`Delete mapping “${p.name}”?`}
                    description="Existing batches are not affected."
                    onConfirm={async () => {
                      await jsonFetch(`/api/mapping-presets/${p.id}`, { method: "DELETE" });
                      router.refresh();
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-success" aria-hidden /> System & privacy
          </CardTitle>
          <CardDescription>Read-only; configured with environment variables.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            File storage: <Badge tone="brand">{system.storage === "s3" ? "S3-compatible" : "Local disk"}</Badge>
          </div>
          <div>
            Generation worker: <Badge tone="brand">{system.worker}</Badge> · {system.concurrency} parallel renders
          </div>
          <div>
            PDF engine: <Badge tone={system.chromium ? "success" : "danger"}>{system.chromium ? "Chromium found" : "Chromium missing"}</Badge>
          </div>
          <div>
            Remote photo URLs: <Badge>{system.remotePhotos ? "allowed (public hosts only)" : "disabled"}</Badge>
          </div>
          <div>Image upload limit: {system.maxImageMb} MB (PNG, JPEG, WebP)</div>
          <div>Downloads are served only to signed-in members of your organisation; no public file URLs.</div>
        </CardContent>
      </Card>
    </div>
  );
}
