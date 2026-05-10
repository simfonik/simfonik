import { Resend } from 'resend';
import { getCoverImageUrl, getTapeById } from '@/lib/data';
import type { Tape } from '@/types/tape';

export const SITE_URL = 'https://simfonik.com';
export const FROM = 'simfonik <mixtapes@io.simfonik.com>';
export const REPLY_TO = 'mixes@simfonik.com';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Fire-and-forget admin notification when a new comment is submitted.
 * Returns silently on missing config or send failure — comment submission
 * must never fail because of an email problem.
 */
export async function sendCommentNotification(opts: {
  tapeId: string;
  authorName: string;
  authorEmail: string | null;
  content: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!adminEmail || !apiKey) return;

  const tape = getTapeById(opts.tapeId);
  if (!tape) return;

  const djName = tape.djs.map((dj) => dj.name).join(' & ');
  const tapeUrl = `${SITE_URL}/tapes/${tape.id}`;
  const adminUrl = `${SITE_URL}/admin/comments`;
  const subject = `New comment on simfonik: ${djName} — ${tape.title}`;

  const safeAuthor = escapeHtml(opts.authorName);
  const safeContent = escapeHtml(opts.content).replace(/\n/g, '<br>');
  const safeEmail = opts.authorEmail ? escapeHtml(opts.authorEmail) : '';

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0a0a0a;background:#f7f7f7;">
  <table cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
    <tr><td style="padding-bottom:8px;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#6b7280;">New comment</td></tr>
    <tr><td style="padding-bottom:16px;font-size:18px;line-height:1.3;">
      <a href="${tapeUrl}" style="color:#0a0a0a;text-decoration:none;font-weight:600;">${escapeHtml(djName)} — ${escapeHtml(tape.title)}</a>
    </td></tr>
    <tr><td style="padding-bottom:8px;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">
      ${safeAuthor}${safeEmail ? ` &middot; ${safeEmail}` : ''}
    </td></tr>
    <tr><td style="padding:12px 16px;background:#fff;border-left:3px solid #0a0a0a;font-size:15px;line-height:1.6;color:#0a0a0a;">
      ${safeContent}
    </td></tr>
    <tr><td style="padding-top:24px;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">
      <a href="${adminUrl}" style="color:#0a0a0a;text-decoration:underline;">Moderate &rarr;</a>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: FROM,
      to: adminEmail,
      replyTo: REPLY_TO,
      subject,
      html,
    });
  } catch (err) {
    // Notifications are best-effort; never propagate to the comment submit flow.
    console.error('sendCommentNotification failed:', err);
  }
}

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
                    <!-- Static PNG of the riso wordmark mark. Source is
                         176×176 (4× the 44px display size) so it stays
                         crisp on retina. PNG is the universally-compatible
                         choice — Gmail strips inline SVG. Regenerate via
                         scripts/generate-wordmark-png.mjs.
                         2px down-shift mirrors site's translate-y-[2px] —
                         optical centering against Anton's baseline. -->
                    <img src="${SITE_URL}/media/site/wordmark-mark.png" alt="" width="44" height="44" style="display:block;transform:translateY(2px);" />
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
