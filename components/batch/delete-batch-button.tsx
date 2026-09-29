"use client";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { jsonFetch } from "@/lib/utils";

export function DeleteBatchButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" className="text-danger">
          <Trash2 /> Delete
        </Button>
      }
      title={`Delete “${name}”?`}
      description="This permanently deletes all candidate records, uploaded photos and generated PDFs in this batch. This cannot be undone."
      confirmLabel="Delete batch"
      onConfirm={async () => {
        try {
          await jsonFetch(`/api/batches/${id}`, { method: "DELETE" });
          toast.success("Batch deleted");
          router.replace("/batches");
          router.refresh();
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    />
  );
}
