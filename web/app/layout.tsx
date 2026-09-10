import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vertion Leads',
  description: 'Comércios do Google Maps que ainda não têm site próprio.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
