import { GetParametersCommand, SSMClient } from "@aws-sdk/client-ssm";

import {
  exigirValorDoParametro,
  FalhaNaLeituraDoCofreError,
  nomeDoParametro,
  NOMES_DOS_PARAMETROS,
  type LeitorDeSegredos,
  type SegredosDaFuncao,
} from "./segredos.ts";

/**
 * O Adapter de SSM da Seam `LeitorDeSegredos` — a Implementation que roda na
 * Função da nuvem (FR-123).
 *
 * A leitura é **uma** chamada `GetParameters` com os três nomes sob o prefixo
 * configurado e `WithDecryption: true`: uma ida ao cofre no início a frio, e
 * não três. Um nome ausente, ou devolvido vazio, é `ParametroAusenteError` com
 * a mensagem que **nomeia o parâmetro** e nunca o valor; uma falha da leitura
 * inteira é `FalhaNaLeituraDoCofreError`, também sem valor algum — a mensagem
 * do SDK **nunca** é propagada.
 *
 * O SDK é fornecido pelo runtime `nodejs24.x` e, por isso, é **externo** no
 * pacote da função: em produção não há o que empacotar. O cliente entra por
 * parâmetro — a Interface `EnviarAoCofre` —, e é assim que os testes substituem
 * o SDK sem que uma única chamada de rede aconteça.
 */

/** Um parâmetro como o cofre o devolve: o nome e o valor, ambos opcionais. */
export interface ParametroDoCofre {
  Name?: string;
  Value?: string;
}

/** A resposta de uma consulta ao cofre. */
export interface RespostaDoCofre {
  Parameters?: readonly ParametroDoCofre[];
}

/**
 * O envio de um comando ao cofre — a Interface mínima por onde os testes entram.
 * O cliente de verdade do SDK a satisfaz, e um duble de teste também.
 */
export type EnviarAoCofre = (
  comando: GetParametersCommand,
) => Promise<RespostaDoCofre>;

/**
 * O envio pelo SDK, com o cliente padrão da região do runtime. A criação do
 * cliente não abre conexão alguma: a chamada só acontece no `send`, e só no
 * início a frio.
 */
function enviarPeloSdk(): EnviarAoCofre {
  const cliente = new SSMClient({});

  return async (comando) => await cliente.send(comando);
}

/**
 * Monta os três segredos a partir dos parâmetros devolvidos, na ordem do
 * contrato: a URL de conexão, o segredo de origem e o segredo das Senhas. O
 * primeiro ausente é o que a falha nomeia.
 */
function segredosDosParametros(
  prefixo: string,
  devolvidos: ReadonlyMap<string, string | undefined>,
): SegredosDaFuncao {
  const completo = (nome: string): string => nomeDoParametro(prefixo, nome);

  return {
    urlDeConexao: exigirValorDoParametro(
      devolvidos.get(completo(NOMES_DOS_PARAMETROS.urlDeConexao)),
      completo(NOMES_DOS_PARAMETROS.urlDeConexao),
    ),
    segredoDeOrigem: exigirValorDoParametro(
      devolvidos.get(completo(NOMES_DOS_PARAMETROS.segredoDeOrigem)),
      completo(NOMES_DOS_PARAMETROS.segredoDeOrigem),
    ),
    segredoDasSenhas: exigirValorDoParametro(
      devolvidos.get(completo(NOMES_DOS_PARAMETROS.segredoDasSenhas)),
      completo(NOMES_DOS_PARAMETROS.segredoDasSenhas),
    ),
  };
}

/** Os nomes devolvidos, indexados pelo nome com que o cofre os devolveu. */
function porNome(
  parametros: readonly ParametroDoCofre[] | undefined,
): Map<string, string | undefined> {
  const valores = new Map<string, string | undefined>();

  for (const parametro of parametros ?? []) {
    if (parametro.Name !== undefined) {
      valores.set(parametro.Name, parametro.Value);
    }
  }

  return valores;
}

/**
 * O leitor que lê os três segredos do cofre, numa chamada só, sob o prefixo
 * informado — `/memorization` na infraestrutura. O envio entra por parâmetro
 * para que os testes substituam o SDK pela Interface; sem ele, vale o cliente
 * padrão do runtime.
 */
export function leitorDeSegredosDoSsm(
  prefixo: string,
  enviar: EnviarAoCofre = enviarPeloSdk(),
): LeitorDeSegredos {
  const nomes = [
    NOMES_DOS_PARAMETROS.urlDeConexao,
    NOMES_DOS_PARAMETROS.segredoDeOrigem,
    NOMES_DOS_PARAMETROS.segredoDasSenhas,
  ].map((nome) => nomeDoParametro(prefixo, nome));

  return {
    async ler(): Promise<SegredosDaFuncao> {
      let resposta: RespostaDoCofre;

      try {
        resposta = await enviar(
          new GetParametersCommand({ Names: nomes, WithDecryption: true }),
        );
      } catch {
        /**
         * A mensagem do SDK não é propagada: ela pode carregar endereço,
         * credencial e o valor decifrado. Fica o prefixo, que não é segredo.
         */
        throw new FalhaNaLeituraDoCofreError(
          `Falha ao ler os segredos no cofre sob o prefixo ${prefixo}.`,
        );
      }

      return segredosDosParametros(prefixo, porNome(resposta.Parameters));
    },
  };
}
