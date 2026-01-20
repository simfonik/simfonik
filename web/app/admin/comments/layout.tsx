import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin: Moderate Comments',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminCommentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
