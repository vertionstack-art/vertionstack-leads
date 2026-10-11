'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker (public/sw.js) e guarda o convite de instalação
 * que o Chrome oferece, para o botão "Instalar no celular" usar depois.
 */
export default function RegistrarApp() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const guardar = (e: Event) => {
      e.preventDefault();
      (window as unknown as { convidarInstalacao?: Event }).convidarInstalacao = e;
    };
    window.addEventListener('beforeinstallprompt', guardar);
    return () => window.removeEventListener('beforeinstallprompt', guardar);
  }, []);
  return null;
}
