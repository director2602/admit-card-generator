export function AppLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#1f2a5c" />
        <rect x="7" y="8" width="18" height="16" rx="2.5" fill="none" stroke="#fff" strokeWidth="2" />
        <rect x="10" y="12" width="5" height="6" rx="1" fill="#c08a2e" />
        <path d="M18 13h4M18 16.5h4M10 21h12" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <div className="leading-tight">
        <div className="text-[15px] font-extrabold tracking-tight">AdmitDesk</div>
        <div className="text-[11px] font-medium text-muted-foreground">Bulk admit cards</div>
      </div>
    </div>
  );
}
