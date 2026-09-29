/* eslint-disable @next/next/no-img-element -- static brand images from /public */
export function AppLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-sm ring-1 ring-black/5">
        <img src="/brand/scubus-mark.png" alt="" className="max-h-full max-w-full object-contain" />
      </span>
      <div className="leading-tight">
        <div className="text-[15px] font-extrabold tracking-tight">S-CUBUS AdmitDesk</div>
        <div className="text-[11px] font-medium text-muted-foreground">Bulk admit cards</div>
      </div>
    </div>
  );
}

/** Full S-CUBUS logo (with tagline) for hero placements. */
export function HeroLogo({ className = "" }: { className?: string }) {
  return <img src="/brand/scubus-logo.png" alt="S-CUBUS — NEET · IIT-JEE · Foundation" className={className} />;
}
