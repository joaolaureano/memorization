// Module demonstracao — conta (030, research R2/R3/R7/R8).

import { randomInt } from "node:crypto";

import { hojeNoFuso } from "../agenda/datas.ts";
import type {
  Baralho,
  Cartao,
  ContaDeTesteArmazenavel,
} from "../armazenamento/porta.ts";
import type { DerivacaoDaSenha } from "../identidade/senha.ts";
import { ALGORITMO_PADRAO } from "../repeticao/algoritmo.ts";
import { ACERVO_DE_DEMONSTRACAO, type CartaoDeDemonstracao } from "./acervo.ts";
import { montarHistorico } from "./historico.ts";

export interface ParametrosDaContaDeTeste {
  /** O instante da criação: vira `contaDeTesteEm` e o dia civil do histórico. */
  agora: Date;
  /** O fuso do visitante, usado para os dias civis do histórico. */
  fuso: string;
  /** Gera um id novo a cada chamada. */
  gerarId: () => string;
  /**
   * Devolve o material da Senha (sal, hash e parâmetros) de uma Senha aleatória
   * que o chamador descarta. O Module não conhece o segredo do servidor, então
   * quem chama deriva a Senha com `derivarDaSenha`.
   */
  credencialAleatoria: () => Promise<DerivacaoDaSenha>;
}

const ALFABETO_DO_NOME = "abcdefghijklmnopqrstuvwxyz0123456789";
const TAMANHO_DO_NOME = 16;

/** `teste-` e 16 caracteres de `[a-z0-9]`, sorteados com CSPRNG (FR-488). */
function nomeDeUsuarioAleatorio(): string {
  let sufixo = "";
  for (let i = 0; i < TAMANHO_DO_NOME; i++) {
    sufixo += ALFABETO_DO_NOME[randomInt(ALFABETO_DO_NOME.length)];
  }
  return `teste-${sufixo}`;
}

/** O Cartão como o armazenamento o guarda, com o id já escolhido. */
function cartaoArmazenado(cartao: CartaoDeDemonstracao, id: string): Cartao {
  const base: Cartao = {
    id,
    frente: cartao.frente,
    verso: cartao.verso,
    tipo: cartao.tipo,
  };
  if (cartao.tags !== undefined) base.tags = [...cartao.tags];
  if (cartao.tipo === "imagem") {
    base.imagemChave = cartao.midiaChave;
    base.textoAlternativo = cartao.textoAlternativo;
  }
  if (cartao.tipo === "audio") {
    base.audioChave = cartao.midiaChave;
    base.audioDuracaoMs = cartao.duracaoMs;
  }
  return base;
}

/**
 * Monta a Conta de teste inteira, sem gravar nada (R2): o Usuário marcado, os
 * três Baralhos com os seus Cartões, o histórico de exemplo com os Agendamentos
 * que sai da reprodução das Avaliações, a Rotina "Inglês" e as Preferências
 * padrão. Duas montagens diferem só em ids, Senha e datas.
 */
export async function montarContaDeTeste({
  agora,
  fuso,
  gerarId,
  credencialAleatoria,
}: ParametrosDaContaDeTeste): Promise<ContaDeTesteArmazenavel> {
  const credencial = await credencialAleatoria();

  const baralhos: { baralho: Baralho; cartoes: Cartao[] }[] = [];
  const cartoesPorRef = new Map<string, Cartao>();

  for (const deck of ACERVO_DE_DEMONSTRACAO.baralhos) {
    const baralho: Baralho = { id: gerarId(), nome: deck.nome };
    const cartoes = deck.cartoes.map((cartao) => {
      const armazenado = cartaoArmazenado(cartao, gerarId());
      cartoesPorRef.set(cartao.ref, armazenado);
      return armazenado;
    });
    baralhos.push({ baralho, cartoes });
  }

  const historico = montarHistorico({ cartoesPorRef, agora, fuso, gerarId });

  const ingles = baralhos[0]!.baralho;
  const hoje = hojeNoFuso(fuso, agora);

  return {
    usuario: {
      id: gerarId(),
      nomeDeUsuario: nomeDeUsuarioAleatorio(),
      sal: credencial.sal,
      hash: credencial.hash,
      parametros: credencial.parametros,
      contaDeTesteEm: agora.toISOString(),
    },
    baralhos,
    registros: historico.registros,
    agendamentos: historico.agendamentos,
    rotina: {
      id: gerarId(),
      criadaEm: agora.toISOString(),
      versao: 1,
      estado: "ativa",
      baralhoId: ingles.id,
      versoes: [
        {
          ordem: 1,
          iniciaEm: hoje,
          baralhoId: ingles.id,
          nomeDoBaralho: ingles.nome,
          dias: [1, 2, 3, 4, 5, 6, 7],
          quantidade: null,
          estado: "ativa",
        },
      ],
    },
    preferencias: { algoritmo: ALGORITMO_PADRAO },
  };
}
