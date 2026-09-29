import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AdmitDesk — Bulk Admit Card Generator", template: "%s · AdmitDesk" },
  description: "Generate branded, print-ready admit cards in bulk from a CSV.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
