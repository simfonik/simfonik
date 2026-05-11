import { buildEmailHtml, SITE_URL } from '@/lib/email';

// Preview page for the new-mix email template. Renders the actual
// HTML in iframes so it picks up email-style isolated CSS context.
// One iframe shows dark mode (the default); the other forces light
// mode by appending an unconditional override style.

const SAMPLE = {
  tapeTitle: 'Moods Version IV: Second Take',
  djName: 'Derrick Carter',
  tapeUrl: `${SITE_URL}/tapes/derrick-carter-moods-version-iv-second-take`,
  coverImageUrl: `${SITE_URL}/optimized/derrick-carter-moods-version-iv-second-take/800.avif`,
  message: 'A fresh transfer of one of Derrick’s best from the Wicker Park years.',
  previewText: 'A fresh transfer of one of Derrick’s best from the Wicker Park years.',
};

// Inline override that always applies the light-mode rules, regardless
// of prefers-color-scheme. Appended to the email HTML for the light
// preview iframe so we don't depend on the viewer's OS theme.
const FORCE_LIGHT = `
<style>
  body.email-bg, table.email-bg { background-color: #f7f7f7 !important; }
  .email-text { color: #0a0a0a !important; }
  .email-muted { color: #6b7280 !important; }
  .email-btn { color: #0a0a0a !important; border-color: #0a0a0a !important; }
  .email-divider { background-color: #0a0a0a !important; }
  .lockup-dark { display: none !important; }
  .lockup-light { display: block !important; }
</style>
`;

export default function SamplePage({
  searchParams,
}: {
  searchParams: Promise<{ host?: string }>;
}) {
  return <SamplePageInner searchParams={searchParams} />;
}

async function SamplePageInner({
  searchParams,
}: {
  searchParams: Promise<{ host?: string }>;
}) {
  const { host } = await searchParams;
  const origin = host ?? 'http://localhost:3000';

  const html = buildEmailHtml(SAMPLE).replaceAll(SITE_URL, origin);
  const lightHtml = html.replace('</body>', `${FORCE_LIGHT}</body>`);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-8">
      <h1 className="font-display text-3xl mb-2">Email preview</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        New-mix newsletter rendered in an isolated iframe. Left = dark
        (default). Right = forced light mode.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <iframe
          srcDoc={html}
          title="Email preview (dark)"
          className="w-full h-[1200px] border border-[var(--border)] rounded-lg"
        />
        <iframe
          srcDoc={lightHtml}
          title="Email preview (light)"
          className="w-full h-[1200px] border border-[var(--border)] rounded-lg"
        />
      </div>
    </main>
  );
}
