'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, FileSpreadsheet, Upload } from 'lucide-react';

/**
 * Importar uma planilha CSV: lê o arquivo no navegador, adivinha qual coluna
 * é o quê pelo cabeçalho, deixa a pessoa corrigir e manda em lotes de 500
 * para /api/leads/importar. Excel e Google Planilhas salvam em CSV por
 * "Arquivo → Salvar como / Fazer download → CSV".
 */

type Campo = 'name' | 'phone' | 'city' | 'category' | 'address' | 'website' | 'instagram' | 'email' | 'notes' | '';

const CAMPOS: { campo: Exclude<Campo, ''>; rotulo: string; sinonimos: string[] }[] = [
  { campo: 'name', rotulo: 'Nome do comércio', sinonimos: ['nome', 'empresa', 'comercio', 'razao social', 'nome fantasia', 'fantasia', 'estabelecimento', 'cliente', 'name', 'business', 'loja'] },
  { campo: 'phone', rotulo: 'Telefone / WhatsApp', sinonimos: ['telefone', 'fone', 'celular', 'whatsapp', 'whats', 'zap', 'phone', 'tel', 'contato'] },
  { campo: 'city', rotulo: 'Cidade', sinonimos: ['cidade', 'municipio', 'city', 'local'] },
  { campo: 'category', rotulo: 'Ramo', sinonimos: ['categoria', 'ramo', 'segmento', 'nicho', 'tipo', 'category', 'atividade'] },
  { campo: 'address', rotulo: 'Endereço', sinonimos: ['endereco', 'rua', 'logradouro', 'address', 'bairro'] },
  { campo: 'website', rotulo: 'Site', sinonimos: ['site', 'website', 'url', 'pagina', 'link'] },
  { campo: 'instagram', rotulo: 'Instagram', sinonimos: ['instagram', 'insta', 'ig'] },
  { campo: 'email', rotulo: 'E-mail', sinonimos: ['email', 'e-mail', 'mail', 'correio'] },
  { campo: 'notes', rotulo: 'Anotação', sinonimos: ['observacao', 'observacoes', 'obs', 'anotacao', 'notas', 'nota', 'comentario', 'comentarios'] },
];

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** CSV com vírgula, ponto e vírgula ou tab; aspas e quebra de linha dentro de aspas */
function lerCsv(bruto: string): string[][] {
  const texto = bruto.replace(/^﻿/, '');
  const primeira = texto.split(/\r?\n/)[0] || '';
  const contar = (c: string) => primeira.split(c).length - 1;
  const sep = [';', ',', '\t'].sort((a, b) => contar(b) - contar(a))[0];
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo);
      campo = '';
      if (linha.some((x) => x.trim())) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim())) linhas.push(linha);
  return linhas;
}

function adivinhar(cabecalho: string): Campo {
  const h = semAcento(cabecalho);
  for (const c of CAMPOS) if (c.sinonimos.some((s) => h === s)) return c.campo;
  for (const c of CAMPOS) if (c.sinonimos.some((s) => h.includes(s))) return c.campo;
  return '';
}

interface Resultado {
  novos: number;
  atualizados: number;
  semNome: number;
  repetidos: number;
  barrados: number;
}

export default function Importar({ vagas }: { vagas: number | null }) {
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<Campo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const cabecalho = linhas[0] || [];
  const corpo = useMemo(() => linhas.slice(1), [linhas]);
  const temNome = mapa.includes('name');

  async function escolher(f: File | undefined) {
    setErro(null);
    setResultado(null);
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setErro('Arquivo grande demais (máximo 5 MB). Divida a planilha em partes.');
    if (/\.(xlsx?|ods|numbers)$/i.test(f.name)) {
      return setErro('Esse arquivo é do Excel. Salve como CSV antes: no Excel, Arquivo → Salvar como → CSV; no Google Planilhas, Arquivo → Fazer download → CSV.');
    }
    const buf = await f.arrayBuffer();
    // planilha salva no Excel brasileiro costuma vir em latin-1, não em UTF-8
    let texto = new TextDecoder('utf-8').decode(buf);
    if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(buf);
    const l = lerCsv(texto);
    if (l.length < 2) return setErro('Não achei linhas nesse arquivo. A primeira linha precisa ser o cabeçalho (Nome, Telefone, Cidade...).');
    if (l.length > 5001) return setErro('Mais de 5.000 linhas. Divida a planilha em partes.');
    setArquivo(f.name);
    setLinhas(l);
    setMapa(l[0].map(adivinhar));
  }

  async function importar() {
    setEnviando(true);
    setErro(null);
    setProgresso(0);
    const total: Resultado = { novos: 0, atualizados: 0, semNome: 0, repetidos: 0, barrados: 0 };
    const objetos = corpo.map((cols) => {
      const o: Record<string, string> = {};
      mapa.forEach((campo, i) => {
        if (!campo || !cols[i]?.trim()) return;
        o[campo] = o[campo] ? `${o[campo]} · ${cols[i].trim()}` : cols[i].trim();
      });
      if (o.instagram && !/^https?:\/\//i.test(o.instagram)) o.instagram = 'https://instagram.com/' + o.instagram.replace(/^@/, '');
      if (o.website && !/^https?:\/\//i.test(o.website) && /\./.test(o.website)) o.website = 'https://' + o.website;
      // sem site, mas com Instagram: entra como "só rede social", não como "sem site"
      if (!o.website && o.instagram) o.website = o.instagram;
      return o;
    });
    try {
      for (let i = 0; i < objetos.length; i += 500) {
        const r = await fetch('/api/leads/importar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linhas: objetos.slice(i, i + 500) }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.erro || 'Não consegui importar.');
        total.novos += j.novos;
        total.atualizados += j.atualizados;
        total.semNome += j.semNome;
        total.repetidos += j.repetidosNoArquivo;
        total.barrados += j.barradosPeloLimite;
        setProgresso(Math.min(objetos.length, i + 500));
      }
      setResultado(total);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui importar.');
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <section className="mt-9 rounded-[24px] bg-menta p-7 text-emerald-950">
        <h2 className="flex items-center gap-2 text-[22px] font-extrabold tracking-[-0.02em]">
          <Check aria-hidden className="h-6 w-6" /> Planilha importada
        </h2>
        <ul className="mt-3 space-y-1 text-[14px] font-semibold">
          <li><b className="tabular-nums">{resultado.novos}</b> comércios novos na sua lista.</li>
          {resultado.atualizados > 0 && <li><b className="tabular-nums">{resultado.atualizados}</b> já estavam na lista e foram completados.</li>}
          {resultado.repetidos > 0 && <li>{resultado.repetidos} linhas repetidas no arquivo foram juntadas.</li>}
          {resultado.semNome > 0 && <li>{resultado.semNome} linhas sem nome ficaram de fora.</li>}
          {resultado.barrados > 0 && <li>{resultado.barrados} não couberam no limite de leads guardados do seu plano.</li>}
        </ul>
        <p className="mt-3 text-[13px]">
          A temperatura de cada um já foi calculada. Para saber quais sites estão fora do ar, use &quot;Conferir sites&quot; no painel.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="/" className="inline-flex min-h-[44px] items-center rounded-full bg-tinta px-5 text-[13.5px] font-bold text-white hover:bg-tinta-70">
            Ver no painel
          </a>
          <button
            type="button"
            onClick={() => { setResultado(null); setLinhas([]); setArquivo(null); }}
            className="inline-flex min-h-[44px] items-center rounded-full bg-white/70 px-5 text-[13.5px] font-bold hover:bg-white"
          >
            Importar outra
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="mt-9 space-y-6">
      <section className="rounded-[24px] border border-zinc-200 p-6">
        <h2 className="text-[17px] font-extrabold">1. Escolha o arquivo</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
          Planilha em CSV, com a primeira linha de cabeçalho (Nome, Telefone, Cidade…). Só o nome é obrigatório.
          {vagas !== null && <> Cabem mais <b className="tabular-nums text-tinta">{vagas.toLocaleString('pt-BR')}</b> leads na sua conta.</>}
        </p>
        <input ref={input} type="file" accept=".csv,text/csv,.txt" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); escolher(e.dataTransfer.files?.[0]); }}
          className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-zinc-300 px-6 py-10 text-center transition-colors hover:border-tinta hover:bg-zinc-50"
        >
          {arquivo ? <FileSpreadsheet aria-hidden className="h-7 w-7" /> : <Upload aria-hidden className="h-7 w-7" />}
          <span className="text-[14px] font-extrabold">{arquivo || 'Clique para escolher ou arraste o arquivo aqui'}</span>
          <span className="text-[12.5px] text-zinc-500">
            {arquivo ? `${corpo.length} linhas encontradas. Clique para trocar.` : 'Do Excel: Arquivo → Salvar como → CSV'}
          </span>
        </button>
        {erro && <p role="alert" className="mt-3 text-[13px] font-semibold text-red-700">{erro}</p>}
      </section>

      {linhas.length > 1 && (
        <section className="rounded-[24px] border border-zinc-200 p-6">
          <h2 className="text-[17px] font-extrabold">2. Confira o que é cada coluna</h2>
          <p className="mt-1 text-[13px] text-zinc-600">Já adivinhei pelo cabeçalho. Ajuste se alguma estiver errada.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead>
                <tr>
                  {cabecalho.map((h, i) => (
                    <th key={i} className="border-b border-zinc-200 px-2 pb-3 align-bottom">
                      <span className="mb-1.5 block truncate text-[11.5px] font-bold text-zinc-500" title={h}>{h || `Coluna ${i + 1}`}</span>
                      <select
                        value={mapa[i] || ''}
                        onChange={(e) => setMapa((m) => m.map((x, j) => (j === i ? (e.target.value as Campo) : x)))}
                        aria-label={`O que é a coluna ${h || i + 1}`}
                        className={`min-h-[34px] w-full min-w-[130px] cursor-pointer rounded-full border px-3 text-[12.5px] font-semibold outline-none ${
                          mapa[i] ? 'border-tinta bg-white' : 'border-zinc-200 bg-zinc-50 text-zinc-500'
                        }`}
                      >
                        <option value="">Não importar</option>
                        {CAMPOS.map((c) => <option key={c.campo} value={c.campo}>{c.rotulo}</option>)}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {corpo.slice(0, 5).map((cols, r) => (
                  <tr key={r} className="border-b border-zinc-100">
                    {cabecalho.map((_, i) => (
                      <td key={i} className={`max-w-[200px] truncate px-2 py-2 ${mapa[i] ? '' : 'text-zinc-400'}`}>{cols[i]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {corpo.length > 5 && <p className="mt-2 text-[12px] text-zinc-500">Mostrando 5 de {corpo.length} linhas.</p>}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!temNome || enviando}
              onClick={importar}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-tinta px-6 text-[13.5px] font-bold text-white transition-colors hover:bg-tinta-70 disabled:bg-zinc-300"
            >
              <Upload aria-hidden className="h-4 w-4" />
              {enviando ? `Importando… ${progresso} de ${corpo.length}` : `Importar ${corpo.length} linhas`}
            </button>
            {!temNome && <span className="text-[12.5px] font-semibold text-red-700">Marque qual coluna é o nome do comércio.</span>}
          </div>
        </section>
      )}
    </div>
  );
}
