import { desc, eq } from "drizzle-orm";
import { Users } from "lucide-react";
import { requirePageSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { examNames } from "@/lib/services/candidates";
import { PageHeader } from "@/components/app/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { CandidateTable } from "@/components/batch/candidate-table";
import { DemoButton } from "@/components/app/demo-button";

export const metadata = { title: "Candidate records" };

export default async function CandidatesPage() {
  const s = await requirePageSession();
  const batches = await db
    .select({ id: schema.batches.id, name: schema.batches.name })
    .from(schema.batches)
    .where(eq(schema.batches.orgId, s.orgId))
    .orderBy(desc(schema.batches.createdAt));
  const exams = await examNames(s.orgId);
  return (
    <>
      <PageHeader title="Candidate records" description="Search every candidate across batches, preview their admit card and download the PDF." />
      {batches.length === 0 ? (
        <EmptyState icon={<Users />} title="No candidates yet" body="Candidates appear here after you import a CSV into a batch." action={<DemoButton />} />
      ) : (
        <Card>
          <CardContent className="p-5">
            <CandidateTable batches={batches} exams={exams} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
