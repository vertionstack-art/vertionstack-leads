import type { Metadata, Viewport } from 'next';
import RegistrarApp from './registrar-app';
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
  // no iPhone, "Adicionar à Tela de Início" abre como aplicativo
  appleWebApp: { capable: true, title: 'Vertion Leads', statusBarStyle: 'default' },
  description: 'Comércios do Google Maps que ainda não têm site próprio.',
};

export const viewport: Viewport = { themeColor: '#0b0b0f' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body className="font-sans antialiased">
        {children}
        <RegistrarApp />
      </body>
    </html>
  );
}
