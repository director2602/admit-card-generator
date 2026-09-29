"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { jsonFetch } from "@/lib/utils";

export function DemoButton({ label = "Try with 100 demo candidates", ...props }: ButtonProps & { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      {...props}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { batch } = await jsonFetch<{ batch: { id: string } }>("/api/demo", { method: "POST" });
          toast.success("Demo batch created with 100 fictional candidates");
          router.push(`/batches/${batch.id}/setup?step=5`);
        } catch (e) {
          toast.error((e as Error).message);
          setBusy(false);
        }
      }}
    >
      <Sparkles /> {busy ? "Creating demo…" : label}
    </Button>
  );
}
