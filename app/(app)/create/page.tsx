import { PageHeader } from "@/components/app/sidebar";
import { StepIndicator } from "@/components/wizard/step-indicator";
import { CreateBatchForm } from "@/components/wizard/create-batch-form";

export const metadata = { title: "Create admit cards" };

export default function CreatePage() {
  return (
    <>
      <PageHeader title="Create admit cards" description="Start a new examination batch. You can upload candidates, design the card and generate PDFs in the next steps." />
      <StepIndicator current={1} />
      <CreateBatchForm />
    </>
  );
}
