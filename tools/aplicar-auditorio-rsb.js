#!/usr/bin/env node
// Aplica o layout exacto do auditório RSB (Metropolitano Lx) conforme o PDF
// "Lista_Setaing_SP_VF.pdf" e atribui os lugares aos inscritos correspondentes.

const fs = require('fs');
const path = require('path');

// ════════════════════════════════════════════════════════════════════════════
// Lista de lugares do PDF — lugar → nome
// ════════════════════════════════════════════════════════════════════════════
const PDF_LUGARES = {
  '1':  'Isabel Forte',
  '2':  'Lara Machado',
  '3':  'Graça Brígida',
  '4':  'Laura Silva',
  '5':  'Luís Abraul',
  '6':  'Joana Jerónimo',
  '7':  'Tiago Bugio',
  '8':  'Hugo Santos',
  '9':  'Alexandre Fernando Mendes Rodrigues',
  '10': 'Luís Santos Reis',
  '11': 'Sandra Daniela Martins Ribeiro',
  '12': 'Armínio Liceia',
  '13': 'Hélder Varandas',
  '14': 'Richard Marques',
  '15': 'Luis Martins',
  '16': 'João Matos',
  '17': 'Miguel Carrilho',
  '18': 'Luís Arega Lopes',
  '19': 'César Magueijo',
  '20': 'Joana Mendonça',
  '21': 'Pedro Henrique Dobrões da Fonseca',
  '22': 'Paulo Nunes',
  '23': 'Roberto Valadares',
  '24': 'Lídio Lopes',
  '25': 'Luísa Costa',
  '26': 'Maria de Fátima Berlinga de Almeida',
  '27': 'João Lima',
  '28': 'Leonardo Pereira',
  '29': 'Nuno Emanuel Coroado',
  '30': 'José Pacheco Pina',
  '31': 'Augusto Oliveira',
  '32': 'Ana Fernandes',
  '33': 'João Joanaz de Melo',
  '34': null, // Sem nome no PDF — lugar reservado
  '35': 'Leandro Portelinha',
  '36': 'Sebastião Damásio',
  '37': 'João Luís Tavares Carolino',
  '38': 'José Miguel Alves',
  '39': 'Hugo Martins',
  '40': 'Pedro de Viterbo Badoni',
  '41': 'Pedro de Viterbo Badoni (Acompanhante)',
  '42': 'Pedro Dias',
  '43': 'Manuel Agostinho',
  '44': 'Fausto Simões',
  '45': 'Márcio Teixeira',
  '46': 'Raquel Milho',
  'R1': 'Isabel Galhardo',
  'R2': 'José Miguel Ferreira',
  'R3': 'Miguel Duarte Fidalgo Moita',
  'R4': null, // Reservado vazio
  'R5': null, // Reservado vazio
  'R6': 'Almerindo Ferreira',
  'R7': 'Ivo Silva',
  'R8': 'Vítor Jorge Machacaz'
};

// ════════════════════════════════════════════════════════════════════════════
// Geração do layout — reproduz a planta da imagem
// 3 sectores: central, esquerdo, direito
// ════════════════════════════════════════════════════════════════════════════
function gerarLayoutRSB() {
  const cx = 700, cy = 140;
  const layout = [];
  const round = v => Math.round(v * 10) / 10;

  // Helper: coloca lugares num arco — primeiro label à esquerda, último à direita.
  // Em SVG, ang aumenta no sentido horário (cos > 0 = direita). Queremos que
  // lugar inicial (ex: "37") fique à esquerda visualmente → começar em angulo
  // maior (ex: PI/2 + span/2) e decrementar.
  function arcoLugares(labels, raio, angCentroRad, spanRad, fila, sector) {
    const n = labels.length;
    if (n === 0) return;
    const step = n > 1 ? spanRad / (n - 1) : 0;
    // ang maior (=PI/2 + span/2) → cos negativo → à ESQUERDA do palco em SVG
    const iniEsquerda = angCentroRad + spanRad / 2;
    labels.forEach((lab, i) => {
      const t = iniEsquerda - i * step;
      layout.push({
        lugar: lab,
        fila,
        sector,
        x: round(cx + raio * Math.cos(t)),
        y: round(cy + raio * Math.sin(t))
      });
    });
  }

  const D = Math.PI / 180;
  let proxVazio = 47;
  const vazios = n => Array.from({ length: n }, () => String(proxVazio++));

  // ════════ BLOCO CENTRAL ════════
  // 8 filas concêntricas centradas em 90° (directamente abaixo do palco)
  // Filas A-C têm lugares atribuídos do PDF; D-H ficam vazias
  const centralCfg = [
    { fila: 'CA', raio: 220, span: 55, labels: ['4','5','6','7','8','9','10','11','12','13'] },                  // 10
    { fila: 'CB', raio: 270, span: 65, labels: ['20','21','22','23','24','25','26','27','28','29','30'] },        // 11
    { fila: 'CC', raio: 320, span: 75, labels: ['37','38','39','40','41','42','43','44','45','46','R4','R5'] },  // 12 (R4,R5 à direita)
    { fila: 'CD', raio: 370, span: 85, n: 14 },
    { fila: 'CE', raio: 420, span: 92, n: 15 },
    { fila: 'CF', raio: 470, span: 100, n: 16 },
    { fila: 'CG', raio: 520, span: 108, n: 17 },
    { fila: 'CH', raio: 570, span: 116, n: 18 }
  ];
  centralCfg.forEach(c => {
    const labs = c.labels || vazios(c.n);
    arcoLugares(labs, c.raio, 90 * D, c.span * D, c.fila, 'central');
  });

  // ════════ LATERAL ESQUERDO ════════
  // Filas A-C com 1-3, 17-19, 34-36 (PDF). D-F vazias.
  // angCentro mais próximo de 145° = entre vertical (90°) e horizonte (180°)
  // span pequeno para evitar curvatura vertical excessiva.
  const esqCfg = [
    { fila: 'EA', raio: 290, angCentro: 145, span: 14, labels: ['1','2','3'] },
    { fila: 'EB', raio: 335, angCentro: 144, span: 16, labels: ['17','18','19'] },
    { fila: 'EC', raio: 380, angCentro: 143, span: 18, labels: ['34','35','36'] },
    { fila: 'ED', raio: 425, angCentro: 142, span: 22, n: 5 },
    { fila: 'EE', raio: 470, angCentro: 141, span: 26, n: 6 },
    { fila: 'EF', raio: 515, angCentro: 140, span: 30, n: 6 }
  ];
  esqCfg.forEach(c => {
    const labsBase = c.labels || vazios(c.n);
    // Pad com vazios à direita para chegar a 6 lugares por fila (visual mais cheio)
    const labs = c.labels ? c.labels.concat(vazios(Math.max(0, 6 - c.labels.length))) : labsBase;
    arcoLugares(labs, c.raio, c.angCentro * D, c.span * D, c.fila, 'esquerdo');
  });

  // ════════ LATERAL DIREITO ════════ (espelho do esquerdo)
  // Fila A: 14, 15, 16, R1, R2, R3 (6 lugares juntos com R*'s à direita)
  // Fila B: 31, 32, 33 + vazios
  // Fila C: R6, R7, R8 + vazios
  const dirCfg = [
    { fila: 'DA', raio: 290, angCentro: 35, span: 14, labels: ['14','15','16','R1','R2','R3'] },
    { fila: 'DB', raio: 335, angCentro: 36, span: 16, labels: ['31','32','33'] },
    { fila: 'DC', raio: 380, angCentro: 37, span: 18, labels: ['R6','R7','R8'] },
    { fila: 'DD', raio: 425, angCentro: 38, span: 22, n: 5 },
    { fila: 'DE', raio: 470, angCentro: 39, span: 26, n: 6 },
    { fila: 'DF', raio: 515, angCentro: 40, span: 30, n: 6 }
  ];
  dirCfg.forEach(c => {
    const labs = c.labels
      ? c.labels.concat(vazios(Math.max(0, 6 - c.labels.length)))
      : vazios(c.n);
    arcoLugares(labs, c.raio, c.angCentro * D, c.span * D, c.fila, 'direito');
  });

  return layout;
}

// ════════════════════════════════════════════════════════════════════════════
// Correspondência de nomes (normalizada)
// ════════════════════════════════════════════════════════════════════════════
function normalizar(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function aplicar() {
  const presencasDir = path.join(__dirname, '..', 'data');
  const eventoPath = path.join(presencasDir, 'evento.json');
  const inscritosPath = path.join(presencasDir, 'inscritos.json');

  const evento = JSON.parse(fs.readFileSync(eventoPath, 'utf8'));
  const inscritosFile = JSON.parse(fs.readFileSync(inscritosPath, 'utf8'));
  const inscritos = inscritosFile.inscritos;

  // Gerar layout
  const layout = gerarLayoutRSB();
  console.log('Layout gerado:', layout.length, 'lugares');

  // Calcular bounds (X mínimo/máximo, Y mínimo/máximo)
  const xs = layout.map(s => s.x), ys = layout.map(s => s.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  console.log('Range X:', minX, '-', maxX, '| Range Y:', minY, '-', maxY);

  const padX = 40, padY = 40;
  const vbX = Math.floor(minX) - padX;
  const vbY = 0;
  const vbW = Math.ceil(maxX - minX) + 2 * padX;
  const vbH = Math.ceil(maxY) + padY;
  const viewBox = vbX + ' ' + vbY + ' ' + vbW + ' ' + vbH;

  // Trasladar tudo para coordenadas positivas
  const offsetX = -vbX;
  layout.forEach(s => { s.x += offsetX; });
  const newVbX = 0;
  const newViewBox = newVbX + ' ' + vbY + ' ' + vbW + ' ' + vbH;

  // Actualizar evento.sala
  evento.sala = evento.sala || {};
  evento.sala.tipo = 'auditorio';
  evento.sala.nome = evento.sala.nome || 'Auditório do Metropolitano de Lisboa';
  evento.sala.totalLugares = layout.length;
  evento.sala.lugares = layout.map(s => s.lugar);
  evento.sala.layout = layout;
  evento.sala.viewBox = newViewBox;
  // Configuração de palco circular centrado horizontalmente
  evento.sala.editorCfg = {
    tipo: 'rsb-auditorio-metro',
    versao: 1,
    descricao: 'Layout exacto do auditório do Metropolitano de Lisboa (PDF Lista_Setaing_SP_VF).'
  };
  evento.actualizadoEm = new Date().toISOString();

  fs.writeFileSync(eventoPath, JSON.stringify(evento, null, 2));
  console.log('evento.json actualizado.');

  // ════════════════════════════════════════════════════════════════════════
  // Atribuir lugares aos inscritos correspondentes
  // ════════════════════════════════════════════════════════════════════════
  // 1. Limpar lugares actuais
  let cleared = 0;
  inscritos.forEach(i => {
    if (i.lugar) { delete i.lugar; cleared++; }
    if (i.lugarAuto) delete i.lugarAuto;
  });
  console.log('Lugares limpos:', cleared);

  // 2. Atribuir conforme PDF
  let atribuidos = 0;
  const naoEncontrados = [];
  for (const [lugar, nomePdf] of Object.entries(PDF_LUGARES)) {
    if (!nomePdf) continue; // Reservado vazio
    const nq = normalizar(nomePdf);
    // Procurar correspondência exacta primeiro
    let match = inscritos.find(i => normalizar(i.nome) === nq);
    // Se não, procurar contém
    if (!match) {
      const matches = inscritos.filter(i => normalizar(i.nome).includes(nq) || nq.includes(normalizar(i.nome)));
      if (matches.length === 1) match = matches[0];
      else if (matches.length > 1) {
        // Filtra acompanhantes — se PDF tem "Acompanhante", procura acompanhante
        if (nomePdf.toLowerCase().includes('acompanhante')) {
          match = matches.find(i => normalizar(i.nome).includes('acompanhante'));
        } else {
          match = matches.find(i => !normalizar(i.nome).includes('acompanhante')) || matches[0];
        }
      }
    }
    if (match) {
      match.lugar = lugar;
      // Estado confirmado (se ainda não estiver)
      if (!match.estado || !/confirm/i.test(match.estado)) match.estado = 'Confirmado';
      atribuidos++;
    } else {
      naoEncontrados.push(lugar + ' ← ' + nomePdf);
    }
  }
  console.log('Atribuídos:', atribuidos);
  if (naoEncontrados.length) {
    console.log('NÃO encontrados:');
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
