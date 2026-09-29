import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePageSession } from "@/lib/auth/session";
import { getTemplate } from "@/lib/services/templates";
import { PageHeader } from "@/components/app/sidebar";
import { Button } from "@/components/ui/button";
import { TemplateEditor } from "@/components/templates/template-editor";

export const metadata = { title: "Edit template" };

export default async function TemplatePage(props: PageProps<"/templates/[id]">) {
  const s = await requirePageSession();
  const { id } = await props.params;
  const t = await getTemplate(s.orgId, id).catch(() => null);
  if (!t) notFound();
  return (
    <>
      <PageHeader
        title="Template designer"
        description="Adjust branding, layout and fields. The preview uses the same renderer as the generated PDFs."
        actions={
          <Button variant="outline" asChild>
            <Link href="/templates">
              <ArrowLeft /> All templates
            </Link>
          </Button>
        }
      />
      <TemplateEditor template={{ id: t.id, name: t.name, config: t.config }} />
    </>
  );
}
