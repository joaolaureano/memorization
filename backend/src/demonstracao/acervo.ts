// Module demonstracao — acervo (030, research R2/R3/R7/R8).

import type { TipoDeCartao } from "../armazenamento/porta.ts";
import { CREDITOS } from "./creditos.ts";

/** Cartão do Acervo de demonstração, antes de ganhar ids (contracts/acervo-de-demonstracao.md). */
export interface CartaoDeDemonstracao {
  /** Nome local, usado só pelo histórico de exemplo; nunca é gravado. */
  ref: string;
  tipo: TipoDeCartao;
  frente: string;
  verso: string;
  tags?: readonly string[];
  textoAlternativo?: string;
  /** Chave da Mídia fixa em `demonstracao/` (Imagem ou Áudio). */
  midiaChave?: string;
  /** Duração do Áudio, lida de `creditos.json`. */
  duracaoMs?: number;
}

export interface BaralhoDeDemonstracao {
  nome: string;
  cartoes: readonly CartaoDeDemonstracao[];
}

/** Duração do Áudio, medida na preparação e registrada em `creditos.json`. */
function duracaoDe(chave: string): number {
  const duracao = CREDITOS.find((credito) => credito.chave === chave)?.duracaoMs;
  if (duracao === undefined) {
    throw new Error(`Duração ausente nos créditos: ${chave}`);
  }
  return duracao;
}

/** Os três Baralhos do Acervo de demonstração, iguais em todas as Contas de teste (FR-491). */
export const ACERVO_DE_DEMONSTRACAO: { readonly baralhos: readonly BaralhoDeDemonstracao[] } = {
  baralhos: [
    {
      nome: "Inglês",
      cartoes: [
        { ref: "apple", tipo: "frente-verso", frente: "apple", verso: "maçã", tags: ["substantivo"] },
        { ref: "book", tipo: "frente-verso", frente: "book", verso: "livro", tags: ["substantivo"] },
        { ref: "house", tipo: "frente-verso", frente: "house", verso: "casa", tags: ["substantivo"] },
        { ref: "water", tipo: "frente-verso", frente: "water", verso: "água", tags: ["substantivo"] },
        { ref: "friend", tipo: "frente-verso", frente: "friend", verso: "amigo", tags: ["substantivo"] },
        { ref: "kitchen", tipo: "frente-verso", frente: "kitchen", verso: "cozinha", tags: ["substantivo"] },
        { ref: "window", tipo: "frente-verso", frente: "window", verso: "janela", tags: ["substantivo"] },
        { ref: "to-learn", tipo: "frente-verso", frente: "to learn", verso: "aprender", tags: ["verbo"] },
        { ref: "to-remember", tipo: "frente-verso", frente: "to remember", verso: "lembrar", tags: ["verbo"] },
        { ref: "to-forget", tipo: "frente-verso", frente: "to forget", verso: "esquecer", tags: ["verbo"] },
        { ref: "beautiful", tipo: "frente-verso", frente: "beautiful", verso: "bonito", tags: ["adjetivo"] },
        { ref: "tomorrow", tipo: "frente-verso", frente: "tomorrow", verso: "amanhã", tags: ["advérbio"] },
      ],
    },
    {
      nome: "Bandeiras",
      cartoes: [
        bandeira("brasil", "Brasil", "Bandeira do Brasil"),
        bandeira("japao", "Japão", "Bandeira do Japão"),
        bandeira("canada", "Canadá", "Bandeira do Canadá"),
        bandeira("alemanha", "Alemanha", "Bandeira da Alemanha"),
        bandeira("italia", "Itália", "Bandeira da Itália"),
        bandeira("argentina", "Argentina", "Bandeira da Argentina"),
        bandeira("india", "Índia", "Bandeira da Índia"),
        bandeira("quenia", "Quênia", "Bandeira do Quênia"),
        bandeira("suecia", "Suécia", "Bandeira da Suécia"),
        bandeira("mexico", "México", "Bandeira do México"),
      ],
    },
    {
      nome: "Cantos de pássaros",
      cartoes: [
        passaro("sabia-laranjeira", "Sabiá-laranjeira (Turdus rufiventris)"),
        passaro("bem-te-vi", "Bem-te-vi (Pitangus sulphuratus)"),
        passaro("joao-de-barro", "João-de-barro (Furnarius rufus)"),
        passaro("cambacica", "Cambacica (Coereba flaveola)"),
        passaro("tico-tico", "Tico-tico (Zonotrichia capensis)"),
        passaro("tiziu", "Tiziu (Volatinia jacarina)"),
        passaro("anu-branco", "Anu-branco (Guira guira)"),
        passaro("corruira", "Corruíra (Troglodytes musculus)"),
        passaro("pomba-asa-branca", "Pomba-asa-branca (Patagioenas picazuro)"),
        passaro("seriema", "Seriema (Cariama cristata)"),
      ],
    },
  ],
};

function bandeira(slug: string, pais: string, textoAlternativo: string): CartaoDeDemonstracao {
  return {
    ref: slug,
    tipo: "imagem",
    frente: "",
    verso: pais,
    textoAlternativo,
    midiaChave: `demonstracao/bandeiras/${slug}.png`,
  };
}

function passaro(slug: string, verso: string): CartaoDeDemonstracao {
  const midiaChave = `demonstracao/passaros/${slug}.mp3`;
  return {
    ref: slug,
    tipo: "audio",
    frente: "",
    verso,
    midiaChave,
    duracaoMs: duracaoDe(midiaChave),
  };
}
