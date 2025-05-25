import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title:
    'NEXT-EVAL: Next Evaluation of Traditional and LLM Web Data Record Extraction',
  description:
    'A comprehensive framework for evaluating and benchmarking web data record extraction methods, comparing traditional algorithms and LLMs with systematic dataset generation from MHTML, structure-aware metrics, and various input preprocessing strategies like Flat JSON for optimal LLM performance.',
  icons: {
    icon: '/next-eval/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
