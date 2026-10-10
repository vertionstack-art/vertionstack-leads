import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

/**
 * A imagem que aparece quando o link é colado no WhatsApp, Instagram,
 * Facebook ou LinkedIn: a mesma folha branca sobre lavanda da página de
 * venda, com a frase, a barra da oportunidade e o teste grátis.
 */

export const alt = 'Vertion Leads: ache quem ainda não tem site e venda o site para ele. Teste grátis com 30 leads.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SEGMENTOS = [
  { rotulo: 'Sem site', fundo: '#0b0b0f', cor: '#ffffff' },
  { rotulo: 'Só rede social', fundo: '#7c3aed', cor: '#ffffff' },
  { rotulo: 'Só marketplace', fundo: '#a78bfa', cor: '#0b0b0f' },
  { rotulo: 'Site fraco', fundo: '#ddd6fe', cor: '#0b0b0f' },
];

export default async function Imagem() {
  const [extra, semi, logo] = await Promise.all([
    readFile(join(process.cwd(), 'app/fontes/Manrope-ExtraBold.ttf')),
    readFile(join(process.cwd(), 'app/fontes/Manrope-SemiBold.ttf')),
    readFile(join(process.cwd(), 'public/logo.png'), 'base64'),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#eceaf5', padding: 28, fontFamily: 'Manrope' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
            borderRadius: 36,
            padding: '44px 56px',
            color: '#0b0b0f',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/png;base64,${logo}`} width={44} height={44} alt="" />
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Vertion Leads</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 34, fontSize: 70, fontWeight: 800, lineHeight: 1, letterSpacing: -2.8 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              Ache quem ainda não tem
              <span
                style={{
                  display: 'flex',
                  marginLeft: 18,
                  padding: '2px 22px 8px',
                  border: '4px solid #0b0b0f',
                  borderRadius: 999,
                  transform: 'rotate(-2deg)',
                }}
              >
                site
              </span>
              .
            </div>
            <div style={{ display: 'flex', marginTop: 10 }}>E venda o site para ele.</div>
          </div>

          <div style={{ display: 'flex', marginTop: 'auto', background: '#dfeafb', borderRadius: 28, padding: 18, gap: 4 }}>
            {SEGMENTOS.map((s, i) => (
              <div
                key={s.rotulo}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  height: 64,
                  padding: '0 18px',
                  whiteSpace: 'nowrap',
                  background: s.fundo,
                  color: s.cor,
                  fontSize: 21,
                  fontWeight: 800,
                  borderTopLeftRadius: i === 0 ? 999 : 0,
                  borderBottomLeftRadius: i === 0 ? 999 : 0,
                }}
              >
                {s.rotulo}
              </div>
            ))}
            <div
              style={{
                width: 132,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 64,
                background: '#ffffff',
                border: '2px solid #d4d4d8',
                borderRadius: 999,
                color: '#71717a',
                fontSize: 20,
                fontWeight: 600,
                textDecoration: 'line-through',
              }}
            >
              Tem site
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 26 }}>
            <div style={{ display: 'flex', background: '#0b0b0f', color: '#ffffff', borderRadius: 999, padding: '14px 28px', fontSize: 24, fontWeight: 800 }}>
              Teste grátis com 30 leads
            </div>
            <span style={{ fontSize: 22, fontWeight: 600, color: '#52525b' }}>Sem cartão de crédito · leads.vertionstack.com</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Manrope', data: extra, style: 'normal', weight: 800 },
        { name: 'Manrope', data: semi, style: 'normal', weight: 600 },
      ],
    },
  );
}
