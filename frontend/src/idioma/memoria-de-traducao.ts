/**
 * Memória de tradução das mensagens (027, FR-015, FR-016, research R14).
 *
 * Avisos e recusas chegam às telas como texto, num idioma (o vigente quando
 * foram produzidos). Ao mostrar, a tela passa o texto por `traduzirMensagem`,
 * que reconhece toda mensagem conhecida do produto, em qualquer dos três
 * idiomas, e a reapresenta no Idioma da interface vigente. Texto desconhecido,
 * como Conteúdo do Usuário, passa intacto (FR-006).
 */

import { en } from "./en";
import { es } from "./es";
import {
  MENSAGENS,
  MENSAGENS_COM_VALOR,
  type ChaveDeMensagem,
  type ChaveDeMensagemComValor,
} from "./mensagens";
import { pt, type Catalogo } from "./pt";
import {
  CODIGOS_DE_RECUSA,
  CONTEXTOS_DE_RECUSA,
  MOTIVOS_DE_RECUSA,
  type RecusaDoServidor,
  type ContextoDaRecusa,
} from "./recusas";
import { IDIOMAS, type Idioma } from "./tipos";

type Produtor = (idioma: Idioma) => string;

const CATALOGOS: Record<Idioma, Catalogo> = { pt, en, es };

/** Números-sentinela que marcam os valores ao montar os padrões. */
const SENTINELAS = [918273645, 546372819] as const;

interface Padrao {
  expressao: RegExp;
  chave: ChaveDeMensagemComValor;
}

let indice: Map<string, Produtor> | null = null;
let padroes: Padrao[] | null = null;

function registrar(mapa: Map<string, Produtor>, produtor: Produtor): void {
  for (const idioma of IDIOMAS) {
    const texto = produtor(idioma);

    if (!mapa.has(texto)) {
      mapa.set(texto, produtor);
    }
  }
}

/** Todos os subconjuntos não vazios dos dias 1 a 7, para a sobreposição. */
function subconjuntosDeDias(): number[][] {
  const resultado: number[][] = [];

  for (let mascara = 1; mascara < 1 << 7; mascara += 1) {
    resultado.push(
      [1, 2, 3, 4, 5, 6, 7].filter((_, posicao) => (mascara & (1 << posicao)) !== 0),
    );
  }

  return resultado;
}

function montarIndice(): Map<string, Produtor> {
  const mapa = new Map<string, Produtor>();

  for (const chave of Object.keys(MENSAGENS.pt) as ChaveDeMensagem[]) {
    registrar(mapa, (idioma) => MENSAGENS[idioma][chave]);
  }

  const recusa = (r: RecusaDoServidor, contexto: ContextoDaRecusa): Produtor =>
    (idioma) => CATALOGOS[idioma].recusa(r, contexto);

  for (const contexto of CONTEXTOS_DE_RECUSA) {
    for (const erro of CODIGOS_DE_RECUSA) {
      registrar(mapa, recusa({ erro }, contexto));

      for (const motivo of MOTIVOS_DE_RECUSA) {
        registrar(mapa, recusa({ erro, motivo }, contexto));
      }
    }
  }

  for (const campo of ["novaSenha", "confirmacaoDaSenha"]) {
    registrar(mapa, recusa({ erro: "dados_invalidos", campo }, "conta"));
  }

  for (const dias of subconjuntosDeDias()) {
    registrar(
      mapa,
      recusa({ erro: "sobreposicao", motivo: "sobreposicao", dias }, "agenda"),
    );
  }

  return mapa;
}

function escaparParaExpressao(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function montarPadroes(): Padrao[] {
  const lista: Padrao[] = [];

  for (const chave of Object.keys(MENSAGENS_COM_VALOR) as ChaveDeMensagemComValor[]) {
    for (const idioma of IDIOMAS) {
      const amostra = MENSAGENS_COM_VALOR[chave][idioma](...SENTINELAS);
      const fonte = escaparParaExpressao(amostra)
        .replace(String(SENTINELAS[0]), "(\\d+)")
        .replace(String(SENTINELAS[1]), "(\\d+)")
        .replace(String(SENTINELAS[1]), "\\2");

      lista.push({ expressao: new RegExp(`^${fonte}$`), chave });
    }
  }

  return lista;
}

/**
 * Apresenta `texto` no `idioma`, quando ele é uma mensagem conhecida do
 * produto; caso contrário, devolve `texto` sem alteração.
 */
export function traduzirMensagem(texto: string, idioma: Idioma): string {
  indice ??= montarIndice();

  const produtor = indice.get(texto);

  if (produtor !== undefined) {
    return produtor(idioma);
  }

  padroes ??= montarPadroes();

  for (const { expressao, chave } of padroes) {
    const encontrado = expressao.exec(texto);

    if (encontrado !== null) {
      return MENSAGENS_COM_VALOR[chave][idioma](
        Number(encontrado[1]),
        Number(encontrado[2]),
      );
    }
  }

  return texto;
}
