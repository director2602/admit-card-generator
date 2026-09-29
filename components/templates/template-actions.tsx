"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { jsonFetch } from "@/lib/utils";

export function NewTemplateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New template
        </Button>
      </DialogTrigger>
      <DialogContent title="New template" description="Start from a ready-made design and customise it.">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setBusy(true);
            try {
              const { template } = await jsonFetch<{ template: { id: string } }>("/api/templates", { method: "POST", json: { name: fd.get("name"), preset: fd.get("preset") } });
              router.push(`/templates/${template.id}`);
            } catch (err) {
              toast.error((err as Error).message);
              setBusy(false);
            }
          }}
        >
          <Field label="Name" htmlFor="tn">
            <Input id="tn" name="name" required maxLength={120} placeholder="e.g. Board exam 2026" />
          </Field>
          <Field label="Start from" htmlFor="tp">
            <NativeSelect id="tp" name="preset" defaultValue="classic">
              <option value="classic">Classic A4 admit card</option>
              <option value="sathii">SATHII three-panel card</option>
            </NativeSelect>
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create & edit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteTemplateButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon" aria-label={`Delete ${name}`}>
          <Trash2 />
        </Button>
      }
      title={`Delete “${name}”?`}
      description="Batches that already used this template keep their own copy and are not affected."
      onConfirm={async () => {
        try {
          await jsonFetch(`/api/templates/${id}`, { method: "DELETE" });
          toast.success("Template deleted");
          router.refresh();
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    />
  );
}
