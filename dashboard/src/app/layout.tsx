import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { getConfig } from '@/lib/config';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: getConfig().appName,
  description: getConfig().appDescription,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
