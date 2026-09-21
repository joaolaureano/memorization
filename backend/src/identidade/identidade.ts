import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import type {
  ArmazenamentoDeUsuarios,
  Usuario,
} from "../armazenamento/porta.ts";
import {
  CREDENCIAL_INVALIDA,
  NOME_DE_USUARIO_EXISTENTE,
  validarNomeDeUsuario,
  validarSenha,
} from "./invariantes.ts";
import type {
  CodigoDeErroDeCadastro,
  CodigoDeErroDeEntrada,
} from "./invariantes.ts";
import { derivarDaSenha, derivarDaSenhaCom } from "./senha.ts";
import type { DerivacaoDaSenha } from "./senha.ts";

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
 * O que `autenticar` recebe: a Credencial apresentada — Nome de usuário e
 * Senha. Ela existe apenas na memória de quem a informou e atravessa a
 * Interface sem deixar estado (FR-079, FR-089).
 */
export interface DadosDeEntrada {
  nomeDeUsuario: string;
  senha: string;
}

/**
 * Resultado de `autenticar`. A recusa é resultado previsto, e não exceção:
 * `credencial_invalida` é a **única** recusa possível de Credencial que não
 * confere, com a mensagem única em português (FR-046, FR-088), e
 * `indisponivel` é a falha do armazenamento — que **não** é Senha errada e não
 * pode ser apresentada como recusa de Credencial (FR-044, FR-045).
 */
export type ResultadoDeEntrada =
  | { ok: true; usuario: UsuarioCadastrado }
  | {
      ok: false;
      erro: CodigoDeErroDeEntrada | "indisponivel";
      mensagem: string;
    };

/**
 * Interface profunda do Module `Identidade`: dois verbos, `cadastrar` e
 * `autenticar`. O primeiro esconde a validação das duas regras, a geração do
 * sal, a derivação da chave com parâmetros versionados e a tradução da
 * violação de unicidade em recusa de domínio; o segundo esconde a
 * reconstrução da derivação, a comparação em tempo constante e a derivação
 * descartável que torna indistinguível a recusa de um Nome de usuário
 * inexistente (FR-088).
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

  /**
   * Confere a Credencial apresentada e devolve o Usuário que entrou.
   *
   * Invariantes que a Interface garante: os espaços ao redor do Nome de
   * usuário são descartados e a comparação ignora maiúsculas e minúsculas, com
   * as mesmas regras do Cadastro, enquanto a Senha é comparada exatamente,
   * preservando os espaços dela (FR-087, SC-036); a Senha é conferida
   * **reconstruindo** a derivação com o `sal` e os `parametros` gravados e
   * comparando as duas chaves em tempo constante, sem gravar nada (FR-089);
   * Nome de usuário inexistente executa a **mesma** derivação, contra um `sal`
   * e um `hash` descartáveis gerados uma única vez, de modo que o tempo de
   * recusa não revele a existência do Nome de usuário (FR-088, SC-029); e a
   * recusa é uma só, com a mensagem única `Nome de usuário ou Senha
   * incorretos.`, que não revela qual parte da Credencial falhou.
   *
   * O sucesso devolve apenas `id` e `nomeDeUsuario`: **a Senha nunca aparece em
   * nenhum retorno**, e nenhuma transformação dela atravessa a Interface
   * (FR-078).
   */
  autenticar(dados: DadosDeEntrada): Promise<ResultadoDeEntrada>;
}

/**
 * A recusa única de Entrar, re-exportada na Interface do Module: é ela que a
 * verificação devolve quando a Credencial não confere e é ela que o Adapter
 * HTTP responde quando o cabeçalho falta ou está malformado — a mesma
 * mensagem, sem revelar qual parte da Credencial falhou (FR-088).
 */
export { CREDENCIAL_INVALIDA } from "./invariantes.ts";

/**
 * Recusa por indisponibilidade do armazenamento: a mesma frase do `Acervo` — a
 * operação **não** passou por concluída e o conteúdo informado continua
 * disponível para nova tentativa (FR-044, FR-045).
 */
const ARMAZENAMENTO_INDISPONIVEL = {
  erro: "indisponivel",
  mensagem: "O armazenamento não está disponível. Tente novamente.",
} as const;

/** Bytes de aleatoriedade da Senha descartável que nunca é apresentada. */
const TAMANHO_DO_DESCARTAVEL = 32;

/**
 * Compara duas chaves derivadas em tempo constante (FR-088). O comprimento é
 * conferido antes porque `timingSafeEqual` recusa comprimentos diferentes; as
 * duas chaves vêm da mesma derivação e têm o tamanho gravado nos parâmetros.
 */
function chavesIguais(gravada: Uint8Array, candidata: Uint8Array): boolean {
  return (
    gravada.length === candidata.length &&
    timingSafeEqual(Buffer.from(gravada), Buffer.from(candidata))
  );
}

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
  /**
   * A derivação **descartável** da recusa uniforme (FR-088, SC-029): um `sal` e
   * um `hash` que nenhuma Senha real produz, contra os quais a Senha informada
   * é derivada quando o Nome de usuário não existe. Sem ela, o caso "Nome de
   * usuário inexistente" responderia sem scrypt algum, e a duração da recusa
   * revelaria se o Nome de usuário existe.
   *
   * Ela é gerada **na criação do Module**, e uma única vez: nenhuma requisição
   * paga por ela, e a recusa por Nome de usuário inexistente custa exatamente o
   * que custa a recusa por Senha errada — uma derivação. Nada dela depende do
   * que chega na requisição nem é reutilizável como Credencial: não é cache de
   * Credencial verificada, e não guarda estado de tentativa alguma (FR-079).
   */
  const descartavel: Promise<DerivacaoDaSenha> = derivarDaSenha(
    segredo,
    randomBytes(TAMANHO_DO_DESCARTAVEL).toString("base64url"),
  );

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

    async autenticar(dados) {
      /** As mesmas regras do Cadastro no Nome de usuário (FR-087). */
      const nomeDeUsuario = dados.nomeDeUsuario.trim();
      const encontrado =
        await armazenamento.obterUsuarioPorNomeDeUsuario(nomeDeUsuario);

      if (!encontrado.ok && encontrado.erro === "indisponivel") {
        /** A falha do armazenamento não é Senha errada (FR-044, FR-045). */
        return { ok: false, ...ARMAZENAMENTO_INDISPONIVEL };
      }

      /**
       * A Senha é comparada **reconstruindo** a derivação do hash guardado —
       * ou a descartável, quando o Nome de usuário não existe, para que os dois
       * casos percorram exatamente o mesmo caminho e custem o mesmo. A Senha
       * informada é usada como veio, com os espaços preservados (FR-087), e
       * nada é gravado (FR-089).
       */
      const referencia = encontrado.ok ? encontrado.valor : await descartavel;

      const candidato = await derivarDaSenhaCom(
        segredo,
        dados.senha,
        referencia.sal,
        referencia.parametros,
      );

      if (!encontrado.ok || !chavesIguais(referencia.hash, candidato)) {
        return { ok: false, ...CREDENCIAL_INVALIDA };
      }

      return {
        ok: true,
        usuario: {
          id: encontrado.valor.id,
          nomeDeUsuario: encontrado.valor.nomeDeUsuario,
        },
      };
    },
  };
}
