/**
 * Amostra M4A (`audio/mp4`) montada em código (T007, research R11).
 *
 * `amostraM4a({ duracaoMs, ... })`: `ftyp`, `moov` com `mvhd`, uma trilha `soun`
 * (`mdhd`, `hdlr`, `stsd` com a entrada `mp4a` e `stco` apontando para o `mdat`),
 * `udta`/`meta` opcionais dentro de `moov` (antes do `mdat`), uma caixa `uuid`
 * de nível superior opcional e um `mdat` de 64 bytes não nulos. O tamanho das
 * caixas não depende dos metadados opcionais de forma que altere o `stco`: a
 * limpeza mantém o tamanho, e a prova disso fica nos testes.
 */

const enc = new TextEncoder();
const UUID_DA_CAIXA = Uint8Array.from({ length: 16 }, (_, i) => 0xa0 + i);
const PAYLOAD_DO_MDAT = Uint8Array.from({ length: 64 }, (_, i) => 0xc0 + (i % 32));
const ESCALA_DO_FILME = 1000;

export interface OpcoesDeM4a {
  duracaoMs: number;
  timescale?: number;
  /** Marca principal do `ftyp`. Padrão `"M4A "`. */
  marca?: string;
  /** Marcas compatíveis do `ftyp`. Padrão `[marca, "isom"]`. */
  compativeis?: string[];
  /** Codec da entrada de amostra da trilha de som. Padrão `"mp4a"`. */
  codec?: "mp4a" | "alac";
  udta?: { titulo?: string; artista?: string; local?: string };
  meta?: { titulo?: string; capa?: Uint8Array };
  /** Acrescenta uma trilha `vide`. */
  video?: boolean;
  /** `mvhd` e `mdhd` com duração zero e `mvex` dentro de `moov`. */
  fragmentado?: boolean;
  /** Texto gravado numa caixa `uuid` de nível superior, depois de `moov`. */
  uuid?: string;
}

export function amostraM4a(opcoes: OpcoesDeM4a): Uint8Array {
  const { duracaoMs } = opcoes;
  if (!Number.isInteger(duracaoMs) || duracaoMs < 0) {
    throw new Error("duracaoMs precisa ser inteiro não negativo");
  }
  const escala = opcoes.timescale ?? 44100;
  const marca = opcoes.marca ?? "M4A ";
  const compativeis = opcoes.compativeis ?? [marca, "isom"];
  const codec = opcoes.codec ?? "mp4a";
  const fragmentado = opcoes.fragmentado ?? false;
  const ticks = fragmentado ? 0 : Math.round((duracaoMs * escala) / 1000);
  const duracaoDoFilme = fragmentado ? 0 : duracaoMs;

  const ftyp = caixa("ftyp", ascii(marca), u32(0), ...compativeis.map(ascii));

  const montar = (offsetDoMdat: number): { moov: Uint8Array; uuid: Uint8Array } => {
    const trilhas: Uint8Array[] = [
      trak({
        id: 1,
        handler: "soun",
        escala,
        ticks,
        duracaoDoFilme,
        entrada: entradaDeSom(codec, escala),
        offsetDoMdat,
      }),
    ];
    if (opcoes.video) {
      trilhas.push(
        trak({
          id: 2,
          handler: "vide",
          escala,
          ticks,
          duracaoDoFilme,
          entrada: caixa("avc1", zeros(78)),
          offsetDoMdat,
        }),
      );
    }
    const filhos: Uint8Array[] = [
      mvhd({ duracao: duracaoDoFilme, proximaTrilha: opcoes.video ? 3 : 2 }),
    ];
    if (fragmentado) {
      filhos.push(
        caixa("mvex", caixa("trex", u32(0), u32(1), u32(1), u32(0), u32(0), u32(0))),
      );
    }
    filhos.push(...trilhas);
    if (opcoes.udta) filhos.push(udta(opcoes.udta));
    if (opcoes.meta) filhos.push(meta(opcoes.meta));
    const moov = caixa("moov", ...filhos);
    const uuid =
      opcoes.uuid === undefined
        ? new Uint8Array(0)
        : caixa("uuid", UUID_DA_CAIXA, enc.encode(opcoes.uuid));
    return { moov, uuid };
  };

  // Primeira passagem só para medir: o tamanho não depende do valor do offset.
  const { moov: moovMedido, uuid: uuidMedido } = montar(0);
  const offsetDoMdat = ftyp.length + moovMedido.length + uuidMedido.length + 8;
  const { moov, uuid } = montar(offsetDoMdat);
  const mdat = caixa("mdat", PAYLOAD_DO_MDAT);
  return cat(ftyp, moov, uuid, mdat);
}

function trak(opcoes: {
  id: number;
  handler: "soun" | "vide";
  escala: number;
  ticks: number;
  duracaoDoFilme: number;
  entrada: Uint8Array;
  offsetDoMdat: number;
}): Uint8Array {
  const { id, handler, escala, ticks, duracaoDoFilme, entrada, offsetDoMdat } = opcoes;
  const tkhd = caixa(
    "tkhd",
    u32(3),
    u32(0),
    u32(0),
    u32(id),
    u32(0),
    u32(duracaoDoFilme),
    zeros(8),
    u16(0),
    u16(0),
    u16(handler === "soun" ? 0x0100 : 0),
    u16(0),
    MATRIZ,
    u32(0),
    u32(0),
  );
  const stsd = caixa("stsd", u32(0), u32(1), entrada);
  const stco = caixa("stco", u32(0), u32(1), u32(offsetDoMdat));
  const stbl = caixa("stbl", stsd, stco);
  const minf = caixa("minf", stbl);
  const mdia = caixa("mdia", mdhd(escala, ticks), hdlr(handler), minf);
  return caixa("trak", tkhd, mdia);
}

function mdhd(escala: number, ticks: number): Uint8Array {
  if (ticks > 0xffffffff) {
    return caixa(
      "mdhd",
      u32(0x01000000),
      u64(0),
      u64(0),
      u32(escala),
      u64(ticks),
      u16(0x55c4),
      u16(0),
    );
  }
  return caixa("mdhd", u32(0), u32(0), u32(0), u32(escala), u32(ticks), u16(0x55c4), u16(0));
}

function mvhd(opcoes: { duracao: number; proximaTrilha: number }): Uint8Array {
  return caixa(
    "mvhd",
    u32(0),
    u32(0),
    u32(0),
    u32(ESCALA_DO_FILME),
    u32(opcoes.duracao),
    u32(0x00010000),
    u16(0x0100),
    u16(0),
    zeros(8),
    MATRIZ,
    zeros(24),
    u32(opcoes.proximaTrilha),
  );
}

function hdlr(handler: string): Uint8Array {
  return caixa("hdlr", u32(0), u32(0), ascii(handler), zeros(12), zeros(1));
}

function entradaDeSom(codec: "mp4a" | "alac", escala: number): Uint8Array {
  return caixa(
    codec,
    zeros(6),
    u16(1),
    zeros(8),
    u16(2),
    u16(16),
    u16(0),
    u16(0),
    u32(escala * 65536),
  );
}

function udta(opcoes: { titulo?: string; artista?: string; local?: string }): Uint8Array {
  const itens: Uint8Array[] = [];
  if (opcoes.titulo !== undefined) itens.push(caixa("©nam", dado(opcoes.titulo)));
  if (opcoes.artista !== undefined) itens.push(caixa("©ART", dado(opcoes.artista)));
  if (opcoes.local !== undefined) itens.push(caixa("©xyz", dado(opcoes.local)));
  return caixa("udta", ...itens);
}

function meta(opcoes: { titulo?: string; capa?: Uint8Array }): Uint8Array {
  const itens: Uint8Array[] = [];
  if (opcoes.titulo !== undefined) itens.push(caixa("©nam", dado(opcoes.titulo)));
  if (opcoes.capa !== undefined) itens.push(caixa("covr", dado(opcoes.capa, 13)));
  // Caixa `meta` de tipo completo: 4 bytes de versão e flags antes dos filhos.
  return caixa("meta", u32(0), hdlr("mdir"), caixa("ilst", ...itens));
}

function dado(conteudo: string | Uint8Array, indicador = 1): Uint8Array {
  const corpo = typeof conteudo === "string" ? enc.encode(conteudo) : conteudo;
  return caixa("data", u32(indicador), u32(0), corpo);
}

function caixa(tipo: string, ...partes: Uint8Array[]): Uint8Array {
  const corpo = cat(...partes);
  const saida = new Uint8Array(8 + corpo.length);
  new DataView(saida.buffer).setUint32(0, saida.length);
  for (let i = 0; i < 4; i++) saida[4 + i] = tipo.charCodeAt(i) & 0xff;
  saida.set(corpo, 8);
  return saida;
}

function cat(...partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((soma, parte) => soma + parte.length, 0);
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const parte of partes) {
    saida.set(parte, pos);
    pos += parte.length;
  }
  return saida;
}

const MATRIZ = cat(
  u32(0x10000),
  u32(0),
  u32(0),
  u32(0),
  u32(0x10000),
  u32(0),
  u32(0),
  u32(0),
  u32(0x40000000),
);

function ascii(texto: string): Uint8Array {
  return enc.encode(texto);
}

function zeros(n: number): Uint8Array {
  return new Uint8Array(n);
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n);
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
}

function u64(n: number): Uint8Array {
  const b = new Uint8Array(8);
  const v = new DataView(b.buffer);
  v.setUint32(0, Math.floor(n / 4294967296));
  v.setUint32(4, n % 4294967296);
  return b;
}
