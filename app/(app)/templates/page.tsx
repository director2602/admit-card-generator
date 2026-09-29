import Link from "next/link";
import { LayoutTemplate } from "lucide-react";
import { requirePageSession } from "@/lib/auth/session";
import { listTemplates, seedOrgTemplates } from "@/lib/services/templates";
import { PageHeader } from "@/components/app/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewTemplateButton, DeleteTemplateButton } from "@/components/templates/template-actions";
import { assetUrl } from "@/lib/template/asset-url";

export const metadata = { title: "Templates & branding" };

export default async function TemplatesPage() {
  const s = await requirePageSession();
  await seedOrgTemplates(s.orgId);
  const templates = await listTemplates(s.orgId);
  return (
    <>
      <PageHeader title="Templates & branding" description="Reusable admit card designs. Each batch keeps a snapshot of the template it was generated with." actions={<NewTemplateButton />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => {
          const logo = assetUrl(t.config.branding.logo);
          return (
            <Card key={t.id} className="group overflow-hidden">
              <Link href={`/templates/${t.id}`} className="block">
                <div className="flex h-32 items-center gap-4 px-5" style={{ background: t.config.branding.primary }}>
                  <div className="flex size-16 items-center justify-center rounded-md bg-white p-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {logo ? <img src={logo} alt="" className="max-h-full max-w-full object-contain" /> : <LayoutTemplate className="text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 text-white">
                    <div className="truncate text-sm font-bold">{t.config.branding.orgName}</div>
                    <div className="truncate text-xs opacity-80">{t.config.header.title}</div>
                  </div>
                </div>
              </Link>
              <CardContent className="flex items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <Link href={`/templates/${t.id}`} className="block truncate font-semibold hover:text-brand hover:underline">
                    {t.name}
                  </Link>
                  <div className="mt-1 flex gap-1.5">
                    <Badge>{t.config.layout === "panel" ? "Three-panel" : "Classic"}</Badge>
                    <Badge>{t.config.page.preset === "custom" ? `${t.config.page.widthMm}×${t.config.page.heightMm} mm` : `${t.config.page.preset} ${t.config.page.orientation}`}</Badge>
                  </div>
                </div>
                <DeleteTemplateButton id={t.id} name={t.name} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
