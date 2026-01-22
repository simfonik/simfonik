import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Rights & Takedown Policy"
  },
  description: "Copyright policy and takedown request process for the simfonik DJ mixtape archive.",
};

export default function RightsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-8 text-3xl font-bold text-[var(--text)]">
          Rights &amp; Takedown
        </h1>

        <div className="space-y-6 text-[var(--text)]">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-[var(--text)]">
              About This Archive
            </h2>
            <p className="text-base leading-relaxed">
              This site is a non-commercial archive dedicated to preserving and sharing DJ mixtapes and live recordings. It exists to document scenes, moments, and artists that are often lost to time, not to sell, monetize, or exploit the work hosted here.
            </p>
            <p className="text-base leading-relaxed mt-4">
              All mixes are shared in good faith for listening and historical reference.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-[var(--text)]">
              Ownership and Rights
            </h2>
            <p className="text-base leading-relaxed">
              Unless explicitly stated otherwise:
            </p>
            <ul className="list-disc ml-6 mt-3 space-y-2">
              <li className="text-base leading-relaxed">
                DJ mixes remain the property of their respective creators.
              </li>
              <li className="text-base leading-relaxed">
                Copyright in the underlying recordings and musical compositions belongs to the original artists, labels, and rights holders.
              </li>
              <li className="text-base leading-relaxed">
                This site claims no ownership over third-party audio content.
              </li>
            </ul>
            <p className="text-base leading-relaxed mt-4">
              The site design, layout, and original written content are owned by the site operator.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-[var(--text)]">
              Source of Content
            </h2>
            <p className="text-base leading-relaxed">
              Content hosted on this site may come from:
            </p>
            <ul className="list-disc ml-6 mt-3 space-y-2">
              <li className="text-base leading-relaxed">
                Direct submissions by DJs or artists
              </li>
              <li className="text-base leading-relaxed">
                Promoters, ravers, or community members
              </li>
              <li className="text-base leading-relaxed">
                Personal archives and physical recordings that have been digitized
              </li>
            </ul>
            <p className="text-base leading-relaxed mt-4">
              If you believe a recording has been posted inaccurately or without appropriate context, please get in touch.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-[var(--text)]">
              Non-Commercial Use
            </h2>
            <p className="text-base leading-relaxed">
              This archive is operated with no commercial intent.
            </p>
            <ul className="list-disc ml-6 mt-3 space-y-2">
              <li className="text-base leading-relaxed">
                No mixes are sold
              </li>
              <li className="text-base leading-relaxed">
                No downloads are gated or monetized
              </li>
              <li className="text-base leading-relaxed">
                No advertising is run against hosted audio
              </li>
            </ul>
            <p className="text-base leading-relaxed mt-4">
              The goal is preservation, access, and documentation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-[var(--text)]">
              Takedown Requests
            </h2>
            <p className="text-base leading-relaxed">
              If you are a rights holder and would like content removed or modified, please contact us at:
            </p>
            <p className="text-base leading-relaxed mt-4 font-semibold">
              rights@simfonik.com
            </p>
            <p className="text-base leading-relaxed mt-4">
              Include:
            </p>
            <ul className="list-disc ml-6 mt-3 space-y-2">
              <li className="text-base leading-relaxed">
                A link to the specific content
              </li>
              <li className="text-base leading-relaxed">
                Proof of ownership or authority to act on behalf of the rights holder
              </li>
              <li className="text-base leading-relaxed">
                The action you are requesting
              </li>
            </ul>
            <p className="text-base leading-relaxed mt-4">
              Requests will be reviewed promptly and honored in good faith.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-[var(--text)]">
              No Endorsement
            </h2>
            <p className="text-base leading-relaxed">
              The presence of a mix or recording on this site does not imply endorsement by the site operator. Views, language, and content within recordings are those of the artists.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-[var(--text)]">
              Disclaimer
            </h2>
            <p className="text-base leading-relaxed">
              All content is provided &ldquo;as is.&rdquo; Availability, accuracy, and completeness are not guaranteed.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
