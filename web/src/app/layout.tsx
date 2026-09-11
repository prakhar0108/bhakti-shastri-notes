import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import './globals.css';
import { appName } from '@/lib/shared';

export const metadata: Metadata = {
  title: appName,
  description:
    'Bhagavad-gita Bhakti Shastri lecture notes, with sidebar navigation, search and Mermaid diagrams.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
