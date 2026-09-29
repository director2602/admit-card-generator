import * as React from "react";

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-input bg-card px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand [&_svg]:size-6">{icon}</div>
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}
