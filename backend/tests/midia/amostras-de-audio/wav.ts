/**
 * Amostra WAV PCM montada em código (T007, research R11).
 *
 * `amostraWav({ segundos, taxa, canais, bits, list? })`: RIFF/WAVE com bloco
 * `fmt ` (formato dado), `LIST`/`INFO` com `INAM=<list>` opcional antes de
 * `data`, e `data` com amostras zeradas do tamanho exato
 * `segundos × taxa × canais × bits / 8`. Segundos fracionários são arredondados
 * na contagem de amostras. `extensivel` troca o `fmt ` por WAVE_FORMAT_EXTENSIBLE;
 * `extras` escreve chunks adicionais antes de `data`.
 */
export function amostraWav(opcoes: {
  segundos: number;
  taxa?: number;
  canais?: number;
  bits?: number;
  formato?: number;
  list?: string;
  /** `fmt ` de 40 bytes com WAVE_FORMAT_EXTENSIBLE (0xFFFE) e o subformato dado. */
  extensivel?: { subformato: 1 | 3 };
  /** Chunks extras (ex.: `id3 `, `bext`, `iXML`, `_PMX`) escritos antes de `data`. */
  extras?: Array<{ id: string; conteudo: string }>;
}): Uint8Array {
  const {
    segundos,
    taxa = 8000,
    canais = 1,
    bits = 16,
    formato = 1,
    list,
    extensivel,
    extras = [],
  } = opcoes;

  if (!Number.isInteger(bits / 8) || bits <= 0) {
    throw new Error("bits precisa ser múltiplo de 8");
  }
  const bytesPorAmostra = bits / 8;
  const quadros = Math.round(segundos * taxa);
  const tamanhoData = quadros * canais * bytesPorAmostra;

  const blocos: Uint8Array[] = [];

  // fmt : PCM ou formato dado, 16 bytes; 40 bytes quando extensível.
  const tamanhoFmt = extensivel === undefined ? 16 : 40;
  const fmt = new DataView(new ArrayBuffer(8 + tamanhoFmt));
  escreverAscii(fmt, 0, "fmt ");
  fmt.setUint32(4, tamanhoFmt, true);
  fmt.setUint16(8, extensivel === undefined ? formato : 0xfffe, true);
  fmt.setUint16(10, canais, true);
  fmt.setUint32(12, taxa, true);
  fmt.setUint32(16, taxa * canais * bytesPorAmostra, true);
  fmt.setUint16(20, canais * bytesPorAmostra, true);
  fmt.setUint16(22, bits, true);
  if (extensivel !== undefined) {
    fmt.setUint16(24, 22, true); // cbSize
    fmt.setUint16(26, bits, true); // wValidBitsPerSample
    fmt.setUint32(28, canais === 1 ? 0x4 : 0x3, true); // dwChannelMask
    fmt.setUint16(32, extensivel.subformato, true); // SubFormat GUID, primeiros 2 bytes
    // Restante do GUID: 00 00 00 00 10 00 80 00 00 AA 00 38 9B 71.
    const restoDoGuid = [0, 0, 0, 0, 0x10, 0, 0x80, 0, 0, 0xaa, 0, 0x38, 0x9b, 0x71];
    restoDoGuid.forEach((valor, i) => fmt.setUint8(34 + i, valor));
  }
  blocos.push(new Uint8Array(fmt.buffer));

  // LIST/INFO/INAM antes de data.
  if (list !== undefined) {
    const texto = new TextEncoder().encode(`${list}\0`);
    const tamanhoInam = texto.byteLength + (texto.byteLength % 2);
    const tamanhoList = 4 + 8 + tamanhoInam;
    const cabecalho = new DataView(new ArrayBuffer(8 + 4 + 8));
    escreverAscii(cabecalho, 0, "LIST");
    cabecalho.setUint32(4, tamanhoList, true);
    escreverAscii(cabecalho, 8, "INFO");
    escreverAscii(cabecalho, 12, "INAM");
    cabecalho.setUint32(16, texto.byteLength, true);
    const corpo = new Uint8Array(tamanhoInam);
    corpo.set(texto);
    blocos.push(new Uint8Array(cabecalho.buffer), corpo);
  }

  // Chunks extras, com pad de um byte quando o conteúdo é ímpar.
  for (const extra of extras) {
    if (extra.id.length !== 4) {
      throw new Error("id de chunk precisa ter 4 caracteres");
    }
    const texto = new TextEncoder().encode(extra.conteudo);
    const cabecalhoExtra = new DataView(new ArrayBuffer(8));
    escreverAscii(cabecalhoExtra, 0, extra.id);
    cabecalhoExtra.setUint32(4, texto.byteLength, true);
    const corpoExtra = new Uint8Array(texto.byteLength + (texto.byteLength % 2));
    corpoExtra.set(texto);
    blocos.push(new Uint8Array(cabecalhoExtra.buffer), corpoExtra);
  }

  // data: amostras zeradas, com pad de um byte quando o tamanho é ímpar.
  const cabecalhoData = new DataView(new ArrayBuffer(8));
  escreverAscii(cabecalhoData, 0, "data");
  cabecalhoData.setUint32(4, tamanhoData, true);
  blocos.push(new Uint8Array(cabecalhoData.buffer), new Uint8Array(tamanhoData + (tamanhoData % 2)));

  const corpoTotal = blocos.reduce((soma, bloco) => soma + bloco.byteLength, 0);
  const saida = new Uint8Array(12 + corpoTotal);
  const riff = new DataView(saida.buffer);
  escreverAscii(riff, 0, "RIFF");
  riff.setUint32(4, 4 + corpoTotal, true);
  escreverAscii(riff, 8, "WAVE");

  let posicao = 12;
  for (const bloco of blocos) {
    saida.set(bloco, posicao);
    posicao += bloco.byteLength;
  }
  return saida;
}

function escreverAscii(vista: DataView, deslocamento: number, texto: string): void {
  for (let i = 0; i < texto.length; i++) {
    vista.setUint8(deslocamento + i, texto.charCodeAt(i));
  }
}
