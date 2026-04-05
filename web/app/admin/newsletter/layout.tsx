import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin: Newsletter',
  robots: { index: false, follow: false },
};

export default function AdminNewsletterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
