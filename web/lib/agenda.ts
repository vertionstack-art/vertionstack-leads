/**
 * Levar um lembrete do CRM para a agenda do celular: link pronto do Google
 * Agenda e arquivo .ics (iPhone, Outlook, qualquer agenda). Evento de 30
 * minutos. Roda no navegador.
 */

export interface EventoAgenda {
  titulo: string;
  inicio: Date;
  detalhes: string;
  link?: string;
}

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const fim = (d: Date) => new Date(d.getTime() + 30 * 60 * 1000);

export function linkGoogleAgenda(e: EventoAgenda): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.titulo,
    dates: `${utc(e.inicio)}/${utc(fim(e.inicio))}`,
    details: e.link ? `${e.detalhes}\n\n${e.link}` : e.detalhes,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** texto do .ics: vírgula, ponto e vírgula e quebra de linha precisam de escape */
const ics = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function arquivoIcs(e: EventoAgenda): string {
  const id = `${utc(e.inicio)}-${Math.random().toString(36).slice(2)}@leads.vertionstack.com`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vertion Leads//Lembrete//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(e.inicio)}`,
    `DTEND:${utc(fim(e.inicio))}`,
    `SUMMARY:${ics(e.titulo)}`,
    `DESCRIPTION:${ics(e.link ? `${e.detalhes}\n\n${e.link}` : e.detalhes)}`,
    ...(e.link ? [`URL:${e.link}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT10M',
    `DESCRIPTION:${ics(e.titulo)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function baixarIcs(e: EventoAgenda, nomeArquivo: string): void {
  const blob = new Blob([arquivoIcs(e)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo.replace(/[^\w\- ]+/g, '').trim().slice(0, 60) + '.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
