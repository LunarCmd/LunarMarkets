import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { getConfig } from '@/lib/config';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

const config = getConfig();

export const metadata: Metadata = {
  title: config.appName,
  description: config.appDescription,
  icons: config.appLogo ? {
    icon: config.appLogo,
    shortcut: config.appLogo,
    apple: config.appLogo,
  } : undefined,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
