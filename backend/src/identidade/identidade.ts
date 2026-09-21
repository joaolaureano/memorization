import { randomUUID } from "node:crypto";

import type {
  ArmazenamentoDeUsuarios,
  Usuario,
} from "../armazenamento/porta.ts";
import {
  NOME_DE_USUARIO_EXISTENTE,
  validarNomeDeUsuario,
  validarSenha,
} from "./invariantes.ts";
import type { CodigoDeErroDeCadastro } from "./invariantes.ts";
import { derivarDaSenha } from "./senha.ts";

/**
 * O Module `Identidade` — o Cadastro de Usuários (FR-071).
 *
 * Ele é separado do `Acervo` porque identidade e acervo são conceitos
 * distintos, com regras que não se tocam: juntá-los produziria um Module sem
 * Locality, em que uma mudança na política de Senha mexeria no mesmo arquivo
 * que lista Baralhos. Aqui vive toda a política de Nome de usuário e de Senha,
 * e é por esta Interface que o Adapter HTTP faz a rota `POST /usuarios` ficar
 * fina.
 *
 * A persistência chega pela segunda Porta, `ArmazenamentoDeUsuarios`: o Module
 * nunca conhece, nomeia ou importa armazenamento concreto (FR-100).
 *
 * Invariantes garantidas pela Interface, que o caller nunca reproduz:
 *
 * - espaços ao redor do Nome de usuário são descartados antes da validação
 *   (`  ana  ` vira `ana`), e os da Senha são preservados (FR-073, FR-075);
 * - o Nome de usuário tem de 3 a 50 caracteres, com letras de `A` a `Z` sem
 *   acento, dígitos, `.`, `_` e `-` (FR-073);
 * - a Senha tem de 8 a 128 caracteres, aceita qualquer caractere e não impõe
 *   regra de composição (FR-075, FR-085);
 * - a unicidade do Nome de usuário não distingue maiúsculas de minúsculas
 *   (FR-074, SC-025), e a violação do esquema é traduzida em recusa de domínio;
 * - **a Senha nunca aparece em nenhum retorno** (FR-076, SC-021): o sucesso
 *   carrega apenas `id` e `nomeDeUsuario`.
 *
 * Toda operação devolve `Promise`, e a falha do armazenamento nunca passa por
 * Cadastro concluído: ela é recusada como `indisponivel`, e o conteúdo
 * informado continua disponível para nova tentativa (FR-044, FR-045).
 */

/**
 * O que `cadastrar` recebe. A Confirmação da Senha **não** faz parte deste
 * contrato: FR-072 é verificado na interface, antes do envio, e a API não
 * recebe esse campo.
 *
 * O objeto pode carregar propriedades além dessas duas: elas são ignoradas,
 * porque a Interface lê apenas os campos canônicos — é assim que a Interface
 * garante que nenhuma propriedade extra alcance o armazenamento.
 */
export interface DadosDeCadastro {
  nomeDeUsuario: string;
  senha: string;
}

/**
 * O Usuário como o Cadastro o devolve: forma de **Interface**, e não de banco.
 * Nada de `sal`, `hash`, `parametros` ou Senha atravessa a Interface.
 */
export interface UsuarioCadastrado {
  id: string;
  nomeDeUsuario: string;
}

/**
 * Resultado de `cadastrar`. Recusa de regra é resultado previsto, e não
 * exceção: o caller distingue `ok` e, na recusa, recebe o código estável e a
 * mensagem em português (FR-046). `indisponivel` é a recusa que vem do
 * armazenamento (FR-044, FR-045).
 */
export type ResultadoDeCadastro =
  | { ok: true; usuario: UsuarioCadastrado }
  | {
      ok: false;
      erro: CodigoDeErroDeCadastro | "indisponivel";
      mensagem: string;
    };

/**
 * Interface profunda do Module `Identidade`: um verbo, `cadastrar`, que esconde
 * a validação das duas regras, a geração do sal, a derivação da chave com
 * parâmetros versionados e a tradução da violação de unicidade em recusa de
 * domínio. A `008-entrar` vai reusar este Module para verificar a Senha.
 */
export interface Identidade {
  /**
   * Cadastra um Usuário com Nome de usuário e Senha.
   *
   * Espaços ao redor do Nome de usuário são descartados antes da validação; a
   * Senha é usada como informada, com os espaços preservados. Um Nome de
   * usuário já cadastrado é recusado como `nome_de_usuario_existente`, sem
   * distinguir maiúsculas de minúsculas, com mensagem clara de que ele já
   * existe (FR-074, SC-025).
   */
  cadastrar(dados: DadosDeCadastro): Promise<ResultadoDeCadastro>;
}

/**
 * Recusa por indisponibilidade do armazenamento: a mesma frase do `Acervo` — a
 * operação **não** passou por concluída e o conteúdo informado continua
 * disponível para nova tentativa (FR-044, FR-045).
 */
const ARMAZENAMENTO_INDISPONIVEL = {
  erro: "indisponivel",
  mensagem: "O armazenamento não está disponível. Tente novamente.",
} as const;

/**
 * Cria o `Identidade` sobre a Porta de Usuários informada — o Adapter do
 * armazenamento local na execução local, o de PostgreSQL na nuvem.
 *
 * O `segredo` entra pela Interface como dependência explícita: o Module não lê
 * `process.env`, o que permite testá-lo com um segredo descartável a cada
 * execução e mantém a leitura do ambiente num único lugar (FR-077).
 */
export function criarIdentidade(
  armazenamento: ArmazenamentoDeUsuarios,
  segredo: string,
): Identidade {
  return {
    async cadastrar(dados) {
      /** O descarte dos espaços ao redor acontece **antes** da validação. */
      const nomeDeUsuario = dados.nomeDeUsuario.trim();
      const falha =
        validarNomeDeUsuario(nomeDeUsuario) ?? validarSenha(dados.senha);

      if (falha !== null) {
        return { ok: false, ...falha };
      }

      const derivacao = await derivarDaSenha(segredo, dados.senha);

      const usuario: Usuario = {
        id: randomUUID(),
        nomeDeUsuario,
        ...derivacao,
      };

      const gravado = await armazenamento.inserirUsuario(usuario);

      if (!gravado.ok) {
        return gravado.erro === "nome_de_usuario_existente"
          ? { ok: false, ...NOME_DE_USUARIO_EXISTENTE }
          : { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      return {
        ok: true,
        usuario: {
          id: gravado.valor.id,
          nomeDeUsuario: gravado.valor.nomeDeUsuario,
        },
      };
    },
  };
}
