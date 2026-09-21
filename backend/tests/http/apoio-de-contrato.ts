import type {
  FastifyInstance,
  InjectOptions,
  LightMyRequestResponse,
} from "fastify";

import { criarAcervo } from "../../src/acervo/acervo.ts";
import {
  abrirArmazenamentoSqlite,
  type ArmazenamentoSqliteAberto,
} from "../../src/armazenamento/sqlite/armazenamento.ts";
import type { AcervoDeUsuario } from "../../src/http/rotas.ts";
import { criarServidor, type OpcoesDoServidor } from "../../src/http/servidor.ts";
import { criarIdentidade, type Identidade } from "../../src/identidade/identidade.ts";
import {
  cadastrarUsuarioDeTeste,
  segredoGerado,
  type CredencialDeTeste,
} from "../armazenamento/usuarios-de-teste.ts";

/**
 * O servidor dos testes de contrato, montado **como na aplicação**: o Adapter
 * do armazenamento local em memória, o `Identidade` sobre ele com um segredo
 * gerado nesta execução, o hook que exige a Credencial e as rotas que cada
 * arquivo registra.
 *
 * Desde a `008-entrar`, toda operação de acervo exige Credencial válida
 * (FR-090): o Usuário é cadastrado pelo **Module**, com Senha gerada nesta
 * execução, e cada requisição leva o cabeçalho `Authorization: Basic ...` — é
 * para isso que existe `pedirComCredencial`, e é por ele que passa toda chamada
 * de acervo de `001` a `006`, sem exceção e sem caso isento.
 */

/** O que um arquivo de contrato recebe para registrar as suas rotas. */
export interface RotasDeContrato {
  readonly servidor: FastifyInstance;
  readonly identidade: Identidade;
  /** O construtor do `Acervo` de um Usuário, como na aplicação (FR-092). */
  readonly acervoDe: AcervoDeUsuario;
}

/**
 * O servidor de contrato em uso por um arquivo: o servidor, o armazenamento, a
 * Credencial do Usuário que entrou e o envio das requisições já com ela.
 */
export interface ServidorDeContrato {
  readonly servidor: FastifyInstance;
  readonly aberto: ArmazenamentoSqliteAberto;
  readonly identidade: Identidade;
  /** O Usuário que entrou: a Credencial que acompanha as requisições. */
  readonly credencial: CredencialDeTeste;
  readonly acervoDe: AcervoDeUsuario;
  /** Cadastra outro Usuário — para os cenários de dois Usuários. */
  cadastrar(nomeDeUsuario: string): Promise<CredencialDeTeste>;
  encerrar(): Promise<void>;
}

/**
 * Monta o servidor de contrato com as rotas que o arquivo registra e devolve o
 * Usuário que entrou, já cadastrado com Senha gerada.
 *
 * As opções de borda — o segredo de origem e a política de outra origem — são
 * repassadas à construção, de modo que um arquivo de teste exercite a **mesma**
 * criação de servidor da aplicação, com ou sem elas. Sem opção alguma, o
 * servidor é o de hoje.
 */
export async function montarServidorDeContrato(
  registrarRotas: (rotas: RotasDeContrato) => void,
  opcoesDoServidor: OpcoesDoServidor = {},
): Promise<ServidorDeContrato> {
  const aberto = await abrirArmazenamentoSqlite(":memory:");
  const identidade = criarIdentidade(aberto.usuarios, segredoGerado());
  const servidor = criarServidor(identidade, opcoesDoServidor);
  const acervoDe: AcervoDeUsuario = (usuarioId) =>
    criarAcervo(aberto.armazenamento, usuarioId);

  registrarRotas({ servidor, identidade, acervoDe });

  const credencial = await cadastrarUsuarioDeTeste(identidade);

  return {
    servidor,
    aberto,
    identidade,
    credencial,
    acervoDe,

    async cadastrar(nomeDeUsuario) {
      return await cadastrarUsuarioDeTeste(identidade, nomeDeUsuario);
    },

    async encerrar() {
      await servidor.close();
      await aberto.encerrar();
    },
  };
}

/**
 * Envia a requisição pelo servidor com a **Credencial informada** no cabeçalho,
 * mesclada aos cabeçalhos do próprio cenário. É por aqui que passa toda chamada
 * de acervo destes arquivos: sem Credencial válida a rota não roda (FR-090), e
 * o cabeçalho que a carrega nunca é escrito em lugar algum (FR-078).
 */
export function pedirComCredencial(
  servidor: FastifyInstance,
  credencial: CredencialDeTeste,
  requisicao: InjectOptions,
): Promise<LightMyRequestResponse> {
  return servidor.inject({
    ...requisicao,
    headers: { ...credencial.cabecalho, ...requisicao.headers },
  });
}
