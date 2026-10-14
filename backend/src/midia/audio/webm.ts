import type { AudioReconhecido, LeitorDeContainer } from "./tipos.ts";

/**
 * Leitor de WebM (`audio/webm`). Reconhece pelo EBML (`DocType` `webm`), exige
 * uma trilha de áudio `A_OPUS` e nenhuma de vídeo, e mede a duração pelo
 * `Info/Duration` ou, sem ele, pelos blocos dos `Cluster`. A limpeza troca
 * `Tags`, `Attachments` e `Info/Title` por `Void` do mesmo tamanho (research R3, R4).
 *
 * Os bytes são hostis: toda leitura é conferida contra o fim do arquivo, e
 * qualquer estrutura inválida devolve `null`, nunca uma exceção.
 */

const ID_EBML = 0x1a45dfa3;
const ID_DOCTYPE = 0x4282;
const ID_SEGMENT = 0x18538067;
const ID_SEEKHEAD = 0x114d9b74;
const ID_INFO = 0x1549a966;
const ID_TIMECODE_SCALE = 0x2ad7b1;
const ID_DURATION = 0x4489;
const ID_TITLE = 0x7ba9;
const ID_TRACKS = 0x1654ae6b;
const ID_TRACK_ENTRY = 0xae;
const ID_TRACK_TYPE = 0x83;
const ID_CODEC_ID = 0x86;
const ID_CLUSTER = 0x1f43b675;
const ID_TIMECODE = 0xe7;
const ID_SIMPLE_BLOCK = 0xa3;
const ID_BLOCK_GROUP = 0xa0;
const ID_BLOCK = 0xa1;
const ID_BLOCK_DURATION = 0x9b;
const ID_CUES = 0x1c53bb6b;
const ID_CHAPTERS = 0x1043a770;
const ID_TAGS = 0x1254c367;
const ID_ATTACHMENTS = 0x1941a469;
const ID_VOID = 0xec;

/** Filhos diretos do Segment: um Cluster de tamanho desconhecido termina ao encontrar um deles. */
const FILHOS_DO_SEGMENT = new Set([
  ID_SEEKHEAD,
  ID_INFO,
  ID_TRACKS,
  ID_CLUSTER,
  ID_CUES,
  ID_CHAPTERS,
  ID_TAGS,
  ID_ATTACHMENTS,
]);

const ESCALA_PADRAO = 1_000_000;
const MAXIMO_DE_ELEMENTOS = 1_000_000;

interface Cabecalho {
  id: number;
  posicao: number;
  inicio: number;
  /** `null` quando o tamanho é desconhecido (permitido só em Segment e Cluster). */
  fim: number | null;
  tamanho: number | null;
}

interface Bloco {
  inicio: number;
  fim: number;
}

interface Estado {
  visao: DataView;
  contador: number;
  escala: number | null;
  duracaoDoInfo: number | null;
  temOpus: boolean;
  temVideo: boolean;
  /** Intervalos a neutralizar: `[inicio, fim)` de cada elemento, com o cabeçalho. */
  paraLimpar: Array<[number, number]>;
  clusters: number;
  ultimoInicio: number | null;
  ultimoIntervalo: number | null;
  maiorInicio: number | null;
  duracaoDoMaiorBloco: number | null;
}

/** Lê um VINT. Com `comMarcador`, o bit de marcador faz parte do valor (IDs). */
function lerVint(
  visao: DataView,
  posicao: number,
  limite: number,
  comMarcador: boolean,
): { valor: number; largura: number; desconhecido: boolean } | null {
  if (posicao >= limite) return null;
  const primeiro = visao.getUint8(posicao);
  let largura = 1;
  let mascara = 0x80;
  while ((primeiro & mascara) === 0) {
    largura++;
    if (largura > 8) return null;
    mascara >>= 1;
  }
  if (posicao + largura > limite) return null;

  const bitsDoPrimeiro = primeiro & (mascara - 1);
  let valor = comMarcador ? primeiro : bitsDoPrimeiro;
  let tudoUm = bitsDoPrimeiro === mascara - 1;
  for (let i = 1; i < largura; i++) {
    const byte = visao.getUint8(posicao + i);
    valor = valor * 256 + byte;
    if (byte !== 0xff) tudoUm = false;
  }
  return { valor, largura, desconhecido: !comMarcador && tudoUm };
}

/** Lê um cabeçalho de elemento que precisa caber em `limite`. Tamanho zero é válido: o elemento não tem conteúdo. */
function lerCabecalho(visao: DataView, posicao: number, limite: number): Cabecalho | null {
  const id = lerVint(visao, posicao, limite, true);
  if (id === null) return null;
  const tamanho = lerVint(visao, posicao + id.largura, limite, false);
  if (tamanho === null) return null;

  const inicio = posicao + id.largura + tamanho.largura;
  if (tamanho.desconhecido) {
    return { id: id.valor, posicao, inicio, fim: null, tamanho: null };
  }
  if (tamanho.valor > limite - inicio) return null;
  return { id: id.valor, posicao, inicio, fim: inicio + tamanho.valor, tamanho: tamanho.valor };
}

function lerUint(visao: DataView, inicio: number, fim: number): number | null {
  const largura = fim - inicio;
  if (largura < 1 || largura > 8) return null;
  let valor = 0;
  for (let i = inicio; i < fim; i++) valor = valor * 256 + visao.getUint8(i);
  return valor;
}

function lerReal(visao: DataView, inicio: number, fim: number): number | null {
  const largura = fim - inicio;
  if (largura === 4) return visao.getFloat32(inicio);
  if (largura === 8) return visao.getFloat64(inicio);
  return null;
}

function lerTexto(visao: DataView, inicio: number, fim: number): string {
  let texto = "";
  for (let i = inicio; i < fim; i++) {
    const byte = visao.getUint8(i);
    if (byte === 0) break;
    texto += String.fromCharCode(byte);
  }
  return texto;
}

/** Percorre os filhos de `[inicio, fim)`, sem nenhum elemento de tamanho desconhecido. */
function percorrerFilhos(
  estado: Estado,
  inicio: number,
  fim: number,
  tratar: (cabecalho: Cabecalho) => boolean,
): boolean {
  let posicao = inicio;
  while (posicao < fim) {
    if (++estado.contador > MAXIMO_DE_ELEMENTOS) return false;
    const cabecalho = lerCabecalho(estado.visao, posicao, fim);
    if (cabecalho === null || cabecalho.fim === null) return false;
    if (!tratar(cabecalho)) return false;
    posicao = cabecalho.fim;
  }
  return true;
}

function lerInfo(estado: Estado, inicio: number, fim: number): boolean {
  return percorrerFilhos(estado, inicio, fim, (filho) => {
    const { visao } = estado;
    const fimDoFilho = filho.fim ?? fim;
    if (filho.id === ID_TIMECODE_SCALE) {
      if (fimDoFilho === filho.inicio) return true;
      const escala = lerUint(visao, filho.inicio, fimDoFilho);
      if (escala === null || escala === 0) return false;
      estado.escala = escala;
    } else if (filho.id === ID_DURATION) {
      if (fimDoFilho === filho.inicio) return true;
      const duracao = lerReal(visao, filho.inicio, fimDoFilho);
      if (duracao === null) return false;
      estado.duracaoDoInfo = duracao;
    } else if (filho.id === ID_TITLE) {
      estado.paraLimpar.push([filho.posicao, fimDoFilho]);
    }
    return true;
  });
}

function lerTrackEntry(estado: Estado, inicio: number, fim: number): boolean {
  let tipo: number | null = null;
  let codec = "";
  const ok = percorrerFilhos(estado, inicio, fim, (filho) => {
    const { visao } = estado;
    const fimDoFilho = filho.fim ?? fim;
    if (filho.id === ID_TRACK_TYPE) {
      if (fimDoFilho === filho.inicio) return true;
      tipo = lerUint(visao, filho.inicio, fimDoFilho);
      return tipo !== null;
    }
    if (filho.id === ID_CODEC_ID) {
      codec = lerTexto(visao, filho.inicio, fimDoFilho);
    }
    return true;
  });
  if (!ok) return false;

  if (tipo === 1) {
    estado.temVideo = true;
  } else if (tipo === 2) {
    // Toda trilha de áudio precisa ser Opus: o navegador e a duração dependem disso.
    if (codec !== "A_OPUS") return false;
    estado.temOpus = true;
  }
  return true;
}

function lerTracks(estado: Estado, inicio: number, fim: number): boolean {
  return percorrerFilhos(estado, inicio, fim, (filho) => {
    if (filho.id !== ID_TRACK_ENTRY) return true;
    return lerTrackEntry(estado, filho.inicio, filho.fim ?? fim);
  });
}

/**
 * Registra um bloco: o tempo absoluto é o do Cluster mais o relativo do bloco.
 * O tamanho do intervalo entre inícios consecutivos cobre o último bloco sem BlockDuration.
 */
function registrarBloco(
  estado: Estado,
  tempoDoCluster: number,
  bloco: Bloco,
  duracaoDoBloco: number | null,
): boolean {
  const { visao } = estado;
  const trilha = lerVint(visao, bloco.inicio, bloco.fim, false);
  if (trilha === null) return false;
  const relativoInicio = bloco.inicio + trilha.largura;
  if (bloco.fim - relativoInicio < 3) return false;

  const relativo = visao.getInt16(relativoInicio);
  const inicioDoBloco = tempoDoCluster + relativo;

  if (estado.ultimoInicio !== null) {
    const intervalo = inicioDoBloco - estado.ultimoInicio;
    if (intervalo > 0) estado.ultimoIntervalo = intervalo;
  }
  estado.ultimoInicio = inicioDoBloco;

  if (estado.maiorInicio === null || inicioDoBloco > estado.maiorInicio) {
    estado.maiorInicio = inicioDoBloco;
    estado.duracaoDoMaiorBloco = duracaoDoBloco;
  }
  return true;
}

function lerBlockGroup(estado: Estado, tempoDoCluster: number, inicio: number, fim: number): boolean {
  let bloco: Bloco | null = null;
  let duracaoDoBloco: number | null = null;
  const ok = percorrerFilhos(estado, inicio, fim, (filho) => {
    const fimDoFilho = filho.fim ?? fim;
    if (filho.id === ID_BLOCK) {
      bloco = { inicio: filho.inicio, fim: fimDoFilho };
    } else if (filho.id === ID_BLOCK_DURATION) {
      if (fimDoFilho === filho.inicio) return true;
      duracaoDoBloco = lerUint(estado.visao, filho.inicio, fimDoFilho);
      return duracaoDoBloco !== null;
    }
    return true;
  });
  if (!ok) return false;
  return bloco === null ? true : registrarBloco(estado, tempoDoCluster, bloco, duracaoDoBloco);
}

/**
 * Lê um Cluster a partir do cabeçalho `cabecalho`. Devolve a posição logo após o
 * Cluster, ou `null` se a estrutura for inválida. Um Cluster de tamanho
 * desconhecido termina no primeiro filho do Segment.
 */
function lerCluster(estado: Estado, cabecalho: Cabecalho, fimDoSegmento: number): number | null {
  const { visao } = estado;
  const fim = cabecalho.fim ?? fimDoSegmento;
  let posicao = cabecalho.inicio;
  let tempoDoCluster: number | null = null;
  estado.clusters++;

  while (posicao < fim) {
    if (++estado.contador > MAXIMO_DE_ELEMENTOS) return null;
    const filho = lerCabecalho(visao, posicao, fim);
    if (filho === null) return null;
    if (cabecalho.fim === null && FILHOS_DO_SEGMENT.has(filho.id)) break;
    if (filho.fim === null) return null;

    if (filho.id === ID_TIMECODE) {
      tempoDoCluster = lerUint(visao, filho.inicio, filho.fim);
      if (tempoDoCluster === null) return null;
    } else if (filho.id === ID_SIMPLE_BLOCK || filho.id === ID_BLOCK_GROUP) {
      // O Timecode vem antes dos blocos, como manda o Matroska.
      if (tempoDoCluster === null) return null;
      const ok =
        filho.id === ID_SIMPLE_BLOCK
          ? registrarBloco(estado, tempoDoCluster, { inicio: filho.inicio, fim: filho.fim }, null)
          : lerBlockGroup(estado, tempoDoCluster, filho.inicio, filho.fim);
      if (!ok) return null;
    }
    posicao = filho.fim;
  }

  return cabecalho.fim ?? posicao;
}

function lerSegment(estado: Estado, inicio: number, fim: number): boolean {
  const { visao } = estado;
  let posicao = inicio;

  while (posicao < fim) {
    if (++estado.contador > MAXIMO_DE_ELEMENTOS) return false;
    const filho = lerCabecalho(visao, posicao, fim);
    if (filho === null) return false;

    if (filho.id === ID_CLUSTER) {
      const proxima = lerCluster(estado, filho, fim);
      if (proxima === null) return false;
      posicao = proxima;
      continue;
    }
    if (filho.fim === null) return false;

    if (filho.id === ID_INFO) {
      if (!lerInfo(estado, filho.inicio, filho.fim)) return false;
    } else if (filho.id === ID_TRACKS) {
      if (!lerTracks(estado, filho.inicio, filho.fim)) return false;
    } else if (filho.id === ID_TAGS || filho.id === ID_ATTACHMENTS) {
      estado.paraLimpar.push([filho.posicao, filho.fim]);
    }
    posicao = filho.fim;
  }
  return true;
}

/** Grava um Void de `[inicio, fim)` com o conteúdo zerado. O tamanho total não muda. */
function escreverVoid(saida: Uint8Array, inicio: number, fim: number): void {
  const total = fim - inicio;
  const largura = total >= 9 ? 8 : 1;
  const conteudo = total - 1 - largura;

  saida[inicio] = ID_VOID;
  let valor = conteudo;
  for (let i = largura - 1; i >= 0; i--) {
    saida[inicio + 1 + i] = valor % 256;
    valor = Math.floor(valor / 256);
  }
  saida[inicio + 1] = (saida[inicio + 1] ?? 0) | (1 << (8 - largura));
  for (let i = inicio + 1 + largura; i < fim; i++) saida[i] = 0;
}

export const lerWebm: LeitorDeContainer = (bytes) => {
  const visao = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const limite = bytes.byteLength;

  const ebml = lerCabecalho(visao, 0, limite);
  if (ebml === null || ebml.id !== ID_EBML || ebml.fim === null) return null;

  let docType: string | null = null;
  let posicaoNoEbml = ebml.inicio;
  while (posicaoNoEbml < ebml.fim) {
    const filho = lerCabecalho(visao, posicaoNoEbml, ebml.fim);
    if (filho === null || filho.fim === null) return null;
    if (filho.id === ID_DOCTYPE) docType = lerTexto(visao, filho.inicio, filho.fim);
    posicaoNoEbml = filho.fim;
  }
  if (docType !== "webm") return null;

  let posicao = ebml.fim;
  let segmento: Cabecalho | null = null;
  while (posicao < limite) {
    const cabecalho = lerCabecalho(visao, posicao, limite);
    if (cabecalho === null) return null;
    if (cabecalho.id === ID_SEGMENT) {
      segmento = cabecalho;
      break;
    }
    if (cabecalho.fim === null) return null;
    posicao = cabecalho.fim;
  }
  if (segmento === null) return null;

  const estado: Estado = {
    visao,
    contador: 0,
    escala: null,
    duracaoDoInfo: null,
    temOpus: false,
    temVideo: false,
    paraLimpar: [],
    clusters: 0,
    ultimoInicio: null,
    ultimoIntervalo: null,
    maiorInicio: null,
    duracaoDoMaiorBloco: null,
  };
  const fimDoSegmento = segmento.fim ?? limite;
  if (!lerSegment(estado, segmento.inicio, fimDoSegmento)) return null;

  if (!estado.temOpus || estado.temVideo) return null;

  const escala = estado.escala ?? ESCALA_PADRAO;
  let duracaoMs: number;
  if (estado.duracaoDoInfo !== null && estado.duracaoDoInfo > 0) {
    duracaoMs = (estado.duracaoDoInfo * escala) / 1_000_000;
  } else {
    if (estado.maiorInicio === null) return null;
    const intervalo = estado.duracaoDoMaiorBloco ?? estado.ultimoIntervalo ?? 0;
    duracaoMs = ((estado.maiorInicio + intervalo) * escala) / 1_000_000;
  }

  const reconhecido: AudioReconhecido = {
    formato: "audio/webm",
    duracaoMs,
    limpar() {
      const saida = bytes.slice();
      for (const [inicio, fim] of estado.paraLimpar) escreverVoid(saida, inicio, fim);
      return saida;
    },
  };
  return reconhecido;
};
