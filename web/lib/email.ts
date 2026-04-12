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

export function buildEmailHtml(opts: {
  tapeTitle: string;
  djName: string;
  tapeUrl: string;
  coverImageUrl: string;
  message: string;
  previewText: string;
}): string {
  const { tapeTitle, djName, tapeUrl, coverImageUrl, message, previewText } = opts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Mix on Simfonik</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Hidden preheader for inbox preview text -->
  <div style="display:none;font-size:1px;color:#0a0a0a;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#131316;border:1px solid #27282d;border-radius:12px;overflow:hidden;">

          <tr>
            <td style="padding:32px 32px 0 32px;">
              <p style="margin:0 0 2px 0;font-size:22px;font-weight:700;color:#f5f5f5;">simfonik</p>
              <p style="margin:0;font-size:12px;color:#6b7280;">DJ mixtape archive</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 0 32px;">
              <img
                src="${coverImageUrl}"
                alt="${tapeTitle} cover"
                width="496"
                style="width:100%;max-width:496px;height:auto;display:block;border-radius:8px;border:1px solid #27282d;"
              />
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 0 32px;">
              <p style="margin:0 0 6px 0;font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">New mix</p>
              <h1 style="margin:0 0 8px 0;font-size:26px;font-weight:700;line-height:1.25;color:#f5f5f5;">${tapeTitle}</h1>
              <p style="margin:0;font-size:16px;color:#b0b0b0;">${djName}</p>
            </td>
          </tr>

          ${message ? `
          <tr>
            <td style="padding:20px 32px 0 32px;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#b0b0b0;">${message}</p>
            </td>
          </tr>` : ''}

          <tr>
            <td style="padding:28px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background-color:#5e6ad2;">
                    <a
                      href="${tapeUrl}"
                      style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;"
                    >
                      Listen Now →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 0 32px;">
              <div style="height:1px;background-color:#27282d;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 28px 32px;">
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
                You're receiving this because you subscribed to the Simfonik mixtape archive newsletter.<br />
                <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
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
