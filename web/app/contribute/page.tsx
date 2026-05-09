import type { Metadata } from "next";
import { ContributeForm } from "./ContributeForm";

export const metadata: Metadata = {
  title: "Contribute - simfonik",
  description: "Share your old mixtapes with the simfonik archive.",
};

export default function ContributePage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-10">
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[0.95] text-[var(--text)] mb-4">
            Contribute
          </h1>
          <p className="text-[var(--muted)] leading-relaxed">
            Have old mixtapes from the 90s rave scene? We&apos;d love to hear from you.
          </p>
        </div>

        <ContributeForm />
      </main>
    </div>
  );
}
