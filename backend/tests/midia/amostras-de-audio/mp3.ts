/**
 * Amostra MP3 montada em código (T007, research R11).
 *
 * `amostraMp3({ quadros, id3v2?, id3v1?, ape? })`: quadros MPEG-1 Layer III a
 * 128 kbps e 44 100 Hz, sem preenchimento e sem CRC (417 bytes por quadro,
 * 1152 amostras por quadro), com corpo zerado. Metadados opcionais em volta do
 * som, nesta ordem: ID3v2.3 no início, APEv2 (`Title` = "Titulo Secreto") e
 * ID3v1 (bloco `TAG` de 128 bytes) no fim.
 */

export interface OpcoesAmostraMp3 {
  quadros: number;
  id3v2?: { titulo?: string; artista?: string; comentario?: string; capa?: Uint8Array };
  id3v1?: { titulo?: string; artista?: string };
  ape?: boolean;
}

const TAMANHO_DO_QUADRO = 417;
const CABECALHO_DO_QUADRO = Uint8Array.of(0xff, 0xfb, 0x90, 0x00);

export function amostraMp3(opcoes: OpcoesAmostraMp3): Uint8Array {
  const { quadros } = opcoes;
  if (!Number.isInteger(quadros) || quadros < 0) {
    throw new Error("quadros precisa ser um inteiro não negativo");
  }

  const partes: Uint8Array[] = [];
  if (opcoes.id3v2) partes.push(id3v2(opcoes.id3v2));
  partes.push(quadrosDeAudio(quadros));
  if (opcoes.ape) partes.push(apeV2("Titulo Secreto"));
  if (opcoes.id3v1) partes.push(id3v1(opcoes.id3v1));
  return concatenar(partes);
}

function quadrosDeAudio(quadros: number): Uint8Array {
  const out = new Uint8Array(quadros * TAMANHO_DO_QUADRO);
  for (let i = 0; i < quadros; i++) out.set(CABECALHO_DO_QUADRO, i * TAMANHO_DO_QUADRO);
  return out;
}

function id3v2(opcoes: NonNullable<OpcoesAmostraMp3["id3v2"]>): Uint8Array {
  const quadros: Uint8Array[] = [];
  if (opcoes.titulo !== undefined) quadros.push(quadroId3("TIT2", corpoDeTexto(opcoes.titulo)));
  if (opcoes.artista !== undefined) quadros.push(quadroId3("TPE1", corpoDeTexto(opcoes.artista)));
  if (opcoes.comentario !== undefined) {
    // COMM: codificação ISO-8859-1, idioma "eng", descrição vazia, texto.
    const corpo = concatenar([Uint8Array.of(0x00, 0x65, 0x6e, 0x67, 0x00), latin1(opcoes.comentario)]);
    quadros.push(quadroId3("COMM", corpo));
  }
  if (opcoes.capa) {
    // APIC: ISO-8859-1, "image/jpeg", capa frontal (3), descrição vazia, imagem.
    const corpo = concatenar([
      Uint8Array.of(0x00),
      latin1("image/jpeg"),
      Uint8Array.of(0x00, 0x03, 0x00),
      opcoes.capa,
    ]);
    quadros.push(quadroId3("APIC", corpo));
  }

  const corpo = concatenar(quadros);
  const cabecalho = new Uint8Array(10);
  cabecalho.set(latin1("ID3"), 0);
  cabecalho[3] = 3; // ID3v2.3
  cabecalho.set(tamanhoSincronizado(corpo.length), 6);
  return concatenar([cabecalho, corpo]);
}

/** Quadro ID3v2.3: id de 4 letras, tamanho de 4 bytes (não sincronizado), 2 bytes de sinalizadores. */
function quadroId3(id: string, corpo: Uint8Array): Uint8Array {
  const out = new Uint8Array(10 + corpo.length);
  out.set(latin1(id), 0);
  new DataView(out.buffer).setUint32(4, corpo.length);
  out.set(corpo, 10);
  return out;
}

/** Quadro de texto: codificação ISO-8859-1 seguida do texto. */
function corpoDeTexto(texto: string): Uint8Array {
  return concatenar([Uint8Array.of(0x00), latin1(texto)]);
}

function tamanhoSincronizado(n: number): Uint8Array {
  return Uint8Array.of((n >>> 21) & 0x7f, (n >>> 14) & 0x7f, (n >>> 7) & 0x7f, n & 0x7f);
}

function id3v1(opcoes: NonNullable<OpcoesAmostraMp3["id3v1"]>): Uint8Array {
  const out = new Uint8Array(128);
  out.set(latin1("TAG"), 0);
  out.set(latin1((opcoes.titulo ?? "").slice(0, 30)), 3);
  out.set(latin1((opcoes.artista ?? "").slice(0, 30)), 33);
  out[127] = 0xff; // sem gênero
  return out;
}

/** Bloco APEv2: cabeçalho (32), um item de texto e rodapé (32). */
function apeV2(titulo: string): Uint8Array {
  const valor = latin1(titulo);
  const item = concatenar([le32(valor.length), le32(0), latin1("Title"), Uint8Array.of(0x00), valor]);
  const tamanhoDoTag = item.length + 32; // itens + rodapé; o cabeçalho não conta
  return concatenar([
    cabecalhoOuRodapeApe(tamanhoDoTag, 0xa0000000),
    item,
    cabecalhoOuRodapeApe(tamanhoDoTag, 0x80000000),
  ]);
}

function cabecalhoOuRodapeApe(tamanhoDoTag: number, sinalizadores: number): Uint8Array {
  const out = new Uint8Array(32);
  out.set(latin1("APETAGEX"), 0);
  new DataView(out.buffer).setUint32(8, 2000, true);
  new DataView(out.buffer).setUint32(12, tamanhoDoTag, true);
  new DataView(out.buffer).setUint32(16, 1, true);
  new DataView(out.buffer).setUint32(20, sinalizadores >>> 0, true);
  return out;
}

function le32(n: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, true);
  return out;
}

function latin1(texto: string): Uint8Array {
  return Uint8Array.from(texto, (c) => c.charCodeAt(0) & 0xff);
}

function concatenar(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((soma, parte) => soma + parte.length, 0);
  const out = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    out.set(parte, posicao);
    posicao += parte.length;
  }
  return out;
}
