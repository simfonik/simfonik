import type { Metadata } from "next";
import { ContributeForm } from "./ContributeForm";

export const metadata: Metadata = {
  title: "Contribute - simfonik",
  description: "Share your old mixtapes with the simfonik archive.",
};

export default function ContributePage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text)]">Contribute</h1>
            <p className="mt-2 text-[var(--muted)]">
              Have old mixtapes from the 90s rave scene? We'd love to hear from you.
            </p>
          </div>

          <ContributeForm />
        </div>
      </main>
    </div>
  );
}
