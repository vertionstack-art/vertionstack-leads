import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  // base dos endereços absolutos (imagem de compartilhamento, links)
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://leads.vertionstack.com'),
  title: 'Vertion Leads',
  description: 'Comércios do Google Maps que ainda não têm site próprio.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
