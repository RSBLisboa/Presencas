#!/usr/bin/env node
// Aplica o LAYOUT DO EDITOR (auditório semicircular padrão) e mapeia os
// 51 inscritos do PDF Lista_Setaing_SP_VF aos lugares correspondentes:
//   PDF "1" → editor "A1", PDF "4" → editor "A4", PDF "R3" → editor "R3", etc.
//
// O layout é gerado pelo mesmo algoritmo que app.js / sala-editor.html usa,
// garantindo que o mapa público (mapa-sala.html) mostra exactamente o mesmo
// auditório que o utilizador vê no editor.

const fs = require('fs');
const path = require('path');

// ════════════════════════════════════════════════════════════════════════════
// Configuração — corresponde ao que o utilizador tem visível no editor
// ════════════════════════════════════════════════════════════════════════════
const CFG = {
  tipo: 'auditorio',
  filas: 7,
  lugaresPorFila: 25,    // 25 alvo: cresce até ~29 nas filas mais distantes → ~196 total + 8R = 204
  corredores: 2,
  corredorLarg: 50,
  seat: 22,
  gapH: 4,
  gapV: 18,
  raio: 220,
  abertura: 170,
  margem: 60,
  palco: true,
  reservados: 8,
  setoresPorFila: null
};

// ════════════════════════════════════════════════════════════════════════════
// Lista PDF: 54 lugares atribuídos
// ════════════════════════════════════════════════════════════════════════════
const PDF_LUGARES = {
  '1':  'Isabel Forte', '2':  'Lara Machado', '3':  'Graça Brígida',
  '4':  'Laura Silva', '5':  'Luís Abraul', '6':  'Joana Jerónimo',
  '7':  'Tiago Bugio', '8':  'Hugo Santos', '9':  'Alexandre Fernando Mendes Rodrigues',
  '10': 'Luís Santos Reis', '11': 'Sandra Daniela Martins Ribeiro', '12': 'Armínio Liceia',
  '13': 'Hélder Varandas', '14': 'Richard Marques', '15': 'Luis Martins',
  '16': 'João Matos', '17': 'Miguel Carrilho', '18': 'Luís Arega Lopes',
  '19': 'César Magueijo', '20': 'Joana Mendonça', '21': 'Pedro Henrique Dobrões da Fonseca',
  '22': 'Paulo Nunes', '23': 'Roberto Valadares', '24': 'Lídio Lopes',
  '25': 'Luísa Costa', '26': 'Maria de Fátima Berlinga de Almeida', '27': 'João Lima',
  '28': 'Leonardo Pereira', '29': 'Nuno Emanuel Coroado', '30': 'José Pacheco Pina',
  '31': 'Augusto Oliveira', '32': 'Ana Fernandes', '33': 'João Joanaz de Melo',
  '34': null, // sem nome no PDF
  '35': 'Leandro Portelinha', '36': 'Sebastião Damásio', '37': 'João Luís Tavares Carolino',
  '38': 'José Miguel Alves', '39': 'Hugo Martins', '40': 'Pedro de Viterbo Badoni',
  '41': 'Pedro de Viterbo Badoni (Acompanhante)', '42': 'Pedro Dias', '43': 'Manuel Agostinho',
  '44': 'Fausto Simões', '45': 'Márcio Teixeira', '46': 'Raquel Milho',
  'R1': 'Isabel Galhardo', 'R2': 'José Miguel Ferreira', 'R3': 'Miguel Duarte Fidalgo Moita',
  'R4': null, 'R5': null,
  'R6': 'Almerindo Ferreira', 'R7': 'Ivo Silva', 'R8': 'Vítor Jorge Machacaz'
};

// ════════════════════════════════════════════════════════════════════════════
// Mapeamento PDF → editor: regras
//   - "N" (numérico do PDF) → fila correspondente + posição "N" dentro da fila
//   - "Rn" → R do editor (fila R)
//   - As "filas" do PDF eram: A=1-16+R1-R3, B=17-33, C=34-46+R4-R5+R6-R8
//   - No editor cada fila começa a numerar de 1 — mantemos a mesma numeração:
//     PDF 4 → A4 (4o lugar da fila A)
//     PDF 17 → B1 (1o lugar da fila B, porque B começa em 17 no PDF)
//     PDF 34 → C1 (1o lugar da fila C)
// ════════════════════════════════════════════════════════════════════════════
function mapearPdfParaEditor(codigoPdf) {
  if (codigoPdf.startsWith('R')) return codigoPdf; // R1..R8 → R1..R8

  const n = parseInt(codigoPdf, 10);
  if (n >= 1 && n <= 16)  return 'A' + n;                  // fila A: 1-16
  if (n >= 17 && n <= 33) return 'B' + (n - 16);           // fila B: 1-17 (PDF 17→B1, 33→B17)
  if (n >= 34 && n <= 46) return 'C' + (n - 33);           // fila C: 1-13 (PDF 34→C1, 46→C13)
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// Gerador de layout (replica gerarAud do app.js)
// ════════════════════════════════════════════════════════════════════════════
function rowLab(idx) {
  let n = idx + 1, s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function distribuirBlocos(n, nBlocos) {
  if (nBlocos < 1) return [n];
  const base = Math.floor(n / nBlocos);
  const resto = n - base * nBlocos;
  const blocos = new Array(nBlocos).fill(base);
  const meio = Math.floor(nBlocos / 2);
  const ordem = [];
  for (let d = 0; d <= nBlocos; d++) {
    if (meio + d < nBlocos) ordem.push(meio + d);
    if (d > 0 && meio - d >= 0) ordem.push(meio - d);
  }
  for (let i = 0; i < resto; i++) blocos[ordem[i % ordem.length]]++;
  return blocos.filter(b => b > 0);
}

function gerarAud(cfg) {
  const rows = [];
  const palcoR = 70;
  const stepV = cfg.seat + cfg.gapV;
  const stepArco = cfg.seat + cfg.gapH;
  const corredorRad = cfg.corredorLarg / Math.max(cfg.raio, 80);
  const aberturaMaxRad = cfg.abertura * Math.PI / 180;
  const filas = [];
  if (cfg.reservados > 0) {
    const raioR = Math.max(palcoR + 50, cfg.raio - 60);
    filas.push({ label: 'R', raio: raioR, n: cfg.reservados, ehR: true });
  }
  let raioAtual = cfg.raio;
  for (let fi = 0; fi < cfg.filas; fi++) {
    const nAlvo = cfg.lugaresPorFila + Math.round(fi * 0.6);
    const arcoMax = raioAtual * aberturaMaxRad;
    const nMaxArco = Math.max(2, Math.floor(arcoMax / stepArco) + 1);
    filas.push({ label: rowLab(fi), raio: raioAtual, n: Math.min(nAlvo, nMaxArco), ehR: false });
    raioAtual += stepV;
  }
  const nBlocos = cfg.corredores + 1;
  let minX = 0, maxX = 0, maxY = 0;
  filas.forEach(f => {
    const slots = [];
    const Krad = stepArco / f.raio;
    const blocos = f.ehR ? [f.n] : distribuirBlocos(f.n, nBlocos);
    const blocosUsar = blocos.length ? blocos : [f.n];
    const spanLug = blocosUsar.reduce((a,b) => a + Math.max(0, (b-1)) * Krad, 0);
    const spanCorr = Math.max(0, blocosUsar.length - 1) * corredorRad;
    const spanTotal = spanLug + spanCorr;
    const ini = Math.PI/2 - spanTotal/2;
    let nr = 1, ang = ini;
    blocosUsar.forEach((nBloco, bi) => {
      for (let i = 0; i < nBloco; i++) {
        const x = f.raio * Math.cos(ang);
        const y = f.raio * Math.sin(ang);
        slots.push({ lugar: f.ehR ? 'R' + nr : nr, fila: f.label, sector: bi, x, y });
        nr++;
        if (i < nBloco - 1) ang += Krad;
      }
      if (bi < blocosUsar.length - 1) {
        ang += corredorRad + (nBloco > 0 ? Krad : 0);
      }
    });
    slots.forEach(s => { minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); maxY = Math.max(maxY, s.y); });
    rows.push({ label: f.label, raio: f.raio, slots });
  });
  const pad = cfg.margem;
  const palcoY = pad + (cfg.palco ? palcoR + 30 : 10);
  const offX = pad + Math.abs(minX);
  const offY = palcoY + (cfg.palco ? 0 : 30);
  rows.forEach(r => r.slots.forEach(s => { s.x += offX; s.y += offY; }));
  return {
    rows,
    bounds: { w: offX + maxX + pad, h: offY + maxY + pad }
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Aplicação
// ════════════════════════════════════════════════════════════════════════════
function normalizar(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function aplicar() {
  const dir = path.join(__dirname, '..', 'data');
  const eventoPath = path.join(dir, 'evento.json');
  const inscritosPath = path.join(dir, 'inscritos.json');

  const evento = JSON.parse(fs.readFileSync(eventoPath, 'utf8'));
  const inscritosFile = JSON.parse(fs.readFileSync(inscritosPath, 'utf8'));
  const inscritos = inscritosFile.inscritos;

  // 1. Gerar layout (igual ao editor)
  const res = gerarAud(CFG);
  const layout = [];
  res.rows.forEach(r => r.slots.forEach(s => {
    // Fila R já tem `s.lugar` no formato "R1", "R2"... então não duplicar a letra.
    const codigo = s.fila === 'R' ? String(s.lugar) : String(s.fila) + s.lugar;
    layout.push({
      lugar: codigo,
      fila: s.fila,
      sector: s.sector,
      x: Math.round(s.x * 10) / 10,
      y: Math.round(s.y * 10) / 10
    });
  }));

  // 2. Calcular viewBox
  const xs = layout.map(s => s.x), ys = layout.map(s => s.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const pad = 30;
  const vbW = Math.ceil(maxX + pad);
  const vbH = Math.ceil(maxY + pad);
  const viewBox = '0 0 ' + vbW + ' ' + vbH;

  // 3. Actualizar evento.sala
  evento.sala = evento.sala || {};
  evento.sala.tipo = 'auditorio';
  evento.sala.nome = evento.sala.nome || 'Auditório do Metropolitano de Lisboa';
  evento.sala.totalLugares = layout.length;
  evento.sala.lugares = layout.map(s => s.lugar);
  evento.sala.layout = layout;
  evento.sala.viewBox = viewBox;
  evento.sala.editorCfg = { ...CFG };
  evento.actualizadoEm = new Date().toISOString();

  fs.writeFileSync(eventoPath, JSON.stringify(evento, null, 2));
  console.log('evento.json actualizado.');
  console.log('  Total lugares:', layout.length);
  console.log('  viewBox:', viewBox);

  // 4. Limpar atribuições existentes
  let cleared = 0;
  inscritos.forEach(i => {
    if (i.lugar) { delete i.lugar; cleared++; }
    if (i.lugarAuto) delete i.lugarAuto;
  });
  console.log('Atribuições limpas:', cleared);

  // 5. Mapear PDF → editor e atribuir
  let atribuidos = 0;
  const naoMapeados = [];
  const naoEncontrados = [];
  const layoutSet = new Set(layout.map(s => s.lugar));

  for (const [pdfCod, nome] of Object.entries(PDF_LUGARES)) {
    if (!nome) continue; // reservado vazio
    const editorCod = mapearPdfParaEditor(pdfCod);
    if (!editorCod) {
      naoMapeados.push(pdfCod + ' (' + nome + ')');
      continue;
    }
    if (!layoutSet.has(editorCod)) {
      naoMapeados.push(pdfCod + '→' + editorCod + ' (' + nome + ') · lugar não existe no layout');
      continue;
    }
    // Procurar inscrito por nome
    const nq = normalizar(nome);
    let match = inscritos.find(i => normalizar(i.nome) === nq);
    if (!match) {
      const matches = inscritos.filter(i => normalizar(i.nome).includes(nq) || nq.includes(normalizar(i.nome)));
      if (matches.length === 1) match = matches[0];
      else if (matches.length > 1) {
        if (nome.toLowerCase().includes('acompanhante')) {
          match = matches.find(i => normalizar(i.nome).includes('acompanhante'));
        } else {
          match = matches.find(i => !normalizar(i.nome).includes('acompanhante')) || matches[0];
        }
      }
    }
    if (match) {
      match.lugar = editorCod;
      if (!match.estado || !/confirm/i.test(match.estado)) match.estado = 'Confirmado';
      atribuidos++;
    } else {
      naoEncontrados.push(pdfCod + ' ← ' + nome);
    }
  }
  console.log('Atribuídos:', atribuidos);
  if (naoMapeados.length) {
    console.log('NÃO mapeados (sem correspondência editor):');
    naoMapeados.forEach(n => console.log('  -', n));
  }
  if (naoEncontrados.length) {
    console.log('NÃO encontrados (nome não consta inscritos.json):');
    naoEncontrados.forEach(n => console.log('  -', n));
  }

  inscritosFile.actualizadoEm = new Date().toISOString();
  inscritosFile.total = inscritos.length;
  fs.writeFileSync(inscritosPath, JSON.stringify(inscritosFile, null, 2));
  console.log('inscritos.json actualizado.');

  return { layout: layout.length, atribuidos };
}

if (require.main === module) {
  const r = aplicar();
  console.log('\n=== Resumo ===');
  console.log('Lugares no layout:', r.layout);
  console.log('Inscritos atribuídos:', r.atribuidos);
}
