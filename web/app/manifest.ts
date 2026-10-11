import type { MetadataRoute } from 'next';

/**
 * Deixa instalar a ferramenta como aplicativo (ícone na tela do celular,
 * abrindo sem a barra do navegador). Quem está logado abre direto no painel.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vertion Leads',
    short_name: 'Vertion Leads',
    description: 'Comércios sem site, prontos para você vender o site.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#eceaf5',
    theme_color: '#0b0b0f',
    lang: 'pt-BR',
    icons: [
      { src: '/icones/app-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icones/app-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icones/app-512-mask.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
