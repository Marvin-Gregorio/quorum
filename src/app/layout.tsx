import type { Metadata } from 'next';
import './globals.css';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Quorum',
  description: 'Run a vote your whole organization can trust.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500&family=Public+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <div className="min-h-screen flex flex-col">
          <div className="grow flex flex-col">{children}</div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
