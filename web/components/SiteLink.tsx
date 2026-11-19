import Link from 'next/link';
import type { AnchorHTMLAttributes } from 'react';

// PROTOTYPE (SIM-37). A link to a page of the site that is not Trainspotter's. On a preview of this branch
// those pages are on the live site (next.config.ts sends every such address there), so the link is to
// another site and is written as one. Left as an app link it was loaded ahead of the click, which cannot
// be done from one site to another, and every page load filled the console with errors.
const LIVE = process.env.NEXT_PUBLIC_LIVE_SITE;

export function SiteLink({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return LIVE ? <a href={`${LIVE}${href}`} {...rest} /> : <Link href={href} {...rest} />;
}
