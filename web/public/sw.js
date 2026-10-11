// Service worker mínimo: existe para o celular oferecer "instalar o app".
// Não guarda nada em cache — os leads mudam o tempo todo e precisam vir
// sempre do servidor.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
