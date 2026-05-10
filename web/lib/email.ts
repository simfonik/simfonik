import { getCoverImageUrl } from '@/lib/data';
import type { Tape } from '@/types/tape';

export const SITE_URL = 'https://simfonik.com';
export const FROM = 'simfonik <mixtapes@io.simfonik.com>';
export const REPLY_TO = 'mixes@simfonik.com';

export function tapeEmailData(tape: Tape, message = '') {
  const djName = tape.djs.map((dj) => dj.name).join(' & ');
  const tapeUrl = `${SITE_URL}/tapes/${tape.id}`;
  const coverImageUrl = getCoverImageUrl(tape);
  const previewText = `New mix just dropped: ${tape.title} by ${djName}`;
  return { djName, tapeUrl, coverImageUrl, message: message.trim(), previewText };
}

/**
 * Build the email subject + matching broadcast name.
 *
 * Default form: `New Mix: <DJs> - <Title>`.
 *
 * Two heuristics keep the line readable:
 *   - 3+ DJs (compilations) collapse to `Various` rather than listing
 *     every name (which can blow past inbox subject truncation).
 *   - 1–2 DJ tapes where the title already names every DJ (e.g. collab
 *     titles like "R.A.W. & Mellinfunk II") drop the prefix entirely:
 *     `New Mix: <Title>`. Match is case-insensitive substring with a
 *     leading "DJ " stripped from each DJ name.
 */
export function formatTapeSubject(tape: Tape): string {
  const djLabel =
    tape.djs.length > 2
      ? 'Various'
      : tape.djs.map((dj) => dj.name).join(' & ');

  const titleLower = tape.title.toLowerCase();
  const allDjsInTitle =
    tape.djs.length <= 2 &&
    tape.djs.every((dj) => {
      const normalized = dj.name.replace(/^DJ\s+/i, '').trim().toLowerCase();
      return normalized.length > 0 && titleLower.includes(normalized);
    });

  return allDjsInTitle
    ? `New Mix: ${tape.title}`
    : `New Mix: ${djLabel} - ${tape.title}`;
}

export function buildEmailHtml(opts: {
  tapeTitle: string;
  djName: string;
  tapeUrl: string;
  coverImageUrl: string;
  message: string;
  previewText: string;
}): string {
  const { tapeTitle, djName, tapeUrl, coverImageUrl, message, previewText } = opts;

  // Default = dark mode (mirrors site's :root.theme-dark in globals.css).
  // Light mode opt-in via prefers-color-scheme: light below.
  // Display type uses Anton via Google Fonts with a bold sans fallback
  // for clients that strip web fonts (Outlook desktop). The riso
  // filter chain doesn't render in any email client, so the wordmark
  // uses plain CMY circles with multiply blend.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark light" />
  <meta name="supported-color-schemes" content="dark light" />
  <title>New Mix on Simfonik</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Anton&display=swap" rel="stylesheet" />
  <style>
    /* Light mode override (default = dark). Inline styles win in most
       email clients, so overrides need !important. Class hooks below
       keep the override surface small. */
    @media (prefers-color-scheme: light) {
      .email-bg { background-color: #f7f7f7 !important; }
      .email-text { color: #0a0a0a !important; }
      .email-muted { color: #6b7280 !important; }
      .email-btn {
        color: #0a0a0a !important;
        border-color: #0a0a0a !important;
      }
      .email-divider { background-color: #0a0a0a !important; }
    }
  </style>
</head>
<body class="email-bg" style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f5f5f5;">
  <!-- Hidden preheader for inbox preview text -->
  <div style="display:none;font-size:1px;color:#0a0a0a;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <tr>
            <td style="padding:28px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:6px;line-height:0;">
                    <!-- 2px down-shift mirrors site's translate-y-[2px] on the
                         wordmark — optical centering against Anton's baseline. -->
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="44" height="44" style="display:block;isolation:isolate;transform:translateY(2px);">
                      <circle cx="245" cy="220" r="100" fill="#1A84C4" style="mix-blend-mode:multiply;" />
                      <circle cx="120" cy="220" r="100" fill="#FB5FB6" style="mix-blend-mode:multiply;" />
                      <circle cx="190" cy="120" r="100" fill="#FDEB44" style="mix-blend-mode:multiply;" />
                    </svg>
                  </td>
                  <td style="vertical-align:middle;">
                    <p class="email-text" style="margin:0;font-family:'Anton',Impact,'Helvetica Neue',Arial,sans-serif;font-size:30px;font-weight:400;line-height:1;color:#f5f5f5;letter-spacing:-0.01em;">simfonik</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 0 32px;">
              <img
                src="${coverImageUrl}"
                alt="${tapeTitle} cover"
                width="496"
                style="width:100%;max-width:496px;height:auto;display:block;"
              />
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 0 32px;">
              <p class="email-muted" style="margin:0 0 8px 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:#a1a1aa;">New mix</p>
              <h1 class="email-text" style="margin:0 0 6px 0;font-family:'Anton',Impact,'Helvetica Neue',Arial,sans-serif;font-size:44px;font-weight:400;line-height:0.95;color:#f5f5f5;letter-spacing:-0.005em;">${tapeTitle}</h1>
              <p class="email-text" style="margin:0;font-size:16px;color:#f5f5f5;">${djName}</p>
            </td>
          </tr>

          ${message ? `
          <tr>
            <td style="padding:20px 32px 0 32px;">
              <p class="email-text" style="margin:0;font-size:15px;line-height:1.6;color:#f5f5f5;">${message.replace(/\n/g, '<br>')}</p>
            </td>
          </tr>` : ''}

          <tr>
            <td style="padding:28px 32px 0 32px;">
              <a
                href="${tapeUrl}"
                class="email-btn"
                style="display:inline-block;padding:11px 22px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f5f5f5;text-decoration:none;background:transparent;border:1.5px solid #f5f5f5;border-radius:2px;"
              >
                Listen Now &rarr;
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:36px 32px 0 32px;">
              <div class="email-divider" style="height:1.5px;background-color:#27282d;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px 28px 32px;">
              <p class="email-muted" style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#a1a1aa;line-height:1.7;">
                You're receiving this because you subscribed to the Simfonik mixtape archive newsletter.<br />
                <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" class="email-muted" style="color:#a1a1aa;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
