/**
 * Amostra WebM montada em código (T007, research R11). Sem ffmpeg: só bytes.
 * Todo tamanho sai como VINT de 8 bytes (ou desconhecido), para o teste poder
 * corromper um tamanho sem mudar a largura do campo.
 */
export interface OpcoesDaAmostraWebm {
  duracaoMs?: number;
  clusters?: number;
  msPorBloco?: number;
  blocosPorCluster?: number;
  tags?: string[];
  anexos?: Uint8Array;
  titulo?: string;
  video?: boolean;
  codec?: string;
  tamanhoDesconhecido?: boolean;
  clustersDesconhecidos?: boolean;
  docType?: string;
}

const CODIFICADOR = new TextEncoder();
const TAMANHO_DESCONHECIDO = Uint8Array.from([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
const CARGA_DO_BLOCO = Uint8Array.from([0x4f, 0x70, 0x75, 0x73, 0x00, 0x01]);

function idDe(valor: number): Uint8Array {
  const bytes: number[] = [];
  for (let v = valor; v > 0; v = Math.floor(v / 256)) bytes.unshift(v % 256);
  return Uint8Array.from(bytes);
}

function tamanho8(valor: number): Uint8Array {
  const out = new Uint8Array(8);
  out[0] = 0x01;
  let v = valor;
  for (let i = 7; i >= 1; i--) {
    out[i] = v % 256;
    v = Math.floor(v / 256);
  }
  return out;
}

function concatena(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((soma, parte) => soma + parte.length, 0);
  const out = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    out.set(parte, posicao);
    posicao += parte.length;
  }
  return out;
}

function elemento(id: number, conteudo: Uint8Array, desconhecido = false): Uint8Array {
  const tamanho = desconhecido ? TAMANHO_DESCONHECIDO : tamanho8(conteudo.length);
  return concatena([idDe(id), tamanho, conteudo]);
}

function uint(valor: number): Uint8Array {
  const bytes: number[] = [];
  let v = valor;
  do {
    bytes.unshift(v % 256);
    v = Math.floor(v / 256);
  } while (v > 0);
  return Uint8Array.from(bytes);
}

function real64(valor: number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setFloat64(0, valor);
  return out;
}

function texto(valor: string): Uint8Array {
  return CODIFICADOR.encode(valor);
}

function trackEntry(numero: number, tipo: number, codec: string): Uint8Array {
  return elemento(
    0xae,
    concatena([elemento(0xd7, uint(numero)), elemento(0x83, uint(tipo)), elemento(0x86, texto(codec))]),
  );
}

/** SimpleBlock: número da trilha (VINT 0x81), tempo relativo (i16), flags (keyframe). */
function bloco(tempoRelativo: number): Uint8Array {
  const cabecalho = new Uint8Array(4);
  cabecalho[0] = 0x81;
  new DataView(cabecalho.buffer).setInt16(1, tempoRelativo);
  cabecalho[3] = 0x80;
  return concatena([cabecalho, CARGA_DO_BLOCO]);
}

export function amostraWebm(opcoes: OpcoesDaAmostraWebm = {}): Uint8Array {
  const {
    duracaoMs,
    clusters = 3,
    msPorBloco = 20,
    blocosPorCluster = 50,
    tags,
    anexos,
    titulo,
    video = false,
    codec = "A_OPUS",
    tamanhoDesconhecido = false,
    clustersDesconhecidos = false,
    docType = "webm",
  } = opcoes;

  const cabecalhoEbml = elemento(0x1a45dfa3, elemento(0x4282, texto(docType)));

  const filhosDoInfo = [elemento(0x2ad7b1, uint(1_000_000))];
  if (duracaoMs !== undefined) filhosDoInfo.push(elemento(0x4489, real64(duracaoMs)));
  if (titulo !== undefined) filhosDoInfo.push(elemento(0x7ba9, texto(titulo)));

  const faixas = [trackEntry(1, 2, codec)];
  if (video) faixas.push(trackEntry(2, 1, "V_VP9"));

  const filhosDoSegmento = [
    elemento(0x1549a966, concatena(filhosDoInfo)),
    elemento(0x1654ae6b, concatena(faixas)),
  ];

  if (tags !== undefined) {
    const simples = [elemento(0x45a3, texto("TITLE")), ...tags.map((valor) => elemento(0x4487, texto(valor)))];
    filhosDoSegmento.push(elemento(0x1254c367, elemento(0x7373, elemento(0x67c8, concatena(simples)))));
  }
  if (anexos !== undefined) {
    filhosDoSegmento.push(elemento(0x1941a469, elemento(0x61a7, elemento(0x465c, anexos))));
  }

  for (let c = 0; c < clusters; c++) {
    const filhos = [elemento(0xe7, uint(c * blocosPorCluster * msPorBloco))];
    for (let k = 0; k < blocosPorCluster; k++) {
      filhos.push(elemento(0xa3, bloco(k * msPorBloco)));
    }
    filhosDoSegmento.push(elemento(0x1f43b675, concatena(filhos), clustersDesconhecidos));
  }

  const segmento = elemento(0x18538067, concatena(filhosDoSegmento), tamanhoDesconhecido);
  return concatena([cabecalhoEbml, segmento]);
}
