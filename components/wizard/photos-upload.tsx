"use client";
import { useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function PhotosUpload({ batchId, initialCount }: { batchId: string; initialCount: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);
    try {
      const res = await fetch(`/api/batches/${batchId}/photos`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setCount(data.total);
      setRejected(data.rejected);
      toast.success(`${data.stored} image(s) uploaded`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidate photos & signatures</CardTitle>
        <CardDescription>
          Your CSV refers to image file names. Upload the images (PNG, JPEG or WebP, max 2 MB each) or one ZIP containing them — they are matched by file name.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <input ref={ref} type="file" multiple accept=".png,.jpg,.jpeg,.webp,.zip" className="sr-only" id="photos" onChange={(e) => upload(e.target.files)} />
        <Button variant="outline" onClick={() => ref.current?.click()} disabled={busy}>
          <ImageUp /> {busy ? "Uploading…" : "Upload images or ZIP"}
        </Button>
        <span className="text-sm text-muted-foreground">
          <b className="text-foreground">{count}</b> image(s) stored for this batch
        </span>
        {rejected.length > 0 && (
          <ul className="w-full list-disc pl-5 text-xs text-danger">
            {rejected.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
