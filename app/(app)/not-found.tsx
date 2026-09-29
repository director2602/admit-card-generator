import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <h1 className="text-2xl font-extrabold">Not found</h1>
      <p className="text-sm text-muted-foreground">This page doesn’t exist or belongs to another organisation.</p>
      <Button asChild>
        <Link href="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
