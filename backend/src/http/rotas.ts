import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { ACESSO_EXPIRADO, SEM_ACESSO } from "../acesso/acesso.ts";
import type { Acessos } from "../acesso/acesso.ts";
import type { Acervo } from "../acervo/acervo.ts";
import {
  FORMATOS_ACEITOS,
  LIMITE_DE_BYTES_DA_IMAGEM,
  type ArmazemDeMidia,
  type FormatoDeAudio,
} from "../midia/armazem.ts";
import {
  LIMITE_DE_BYTES_DO_AUDIO,
  LIMITE_DE_DURACAO_DO_AUDIO_EM_MS,
} from "../midia/audio/reconhecer.ts";
import type { AcaoDeRotina } from "../agenda/tipos.ts";
import { CREDENCIAL_INVALIDA } from "../identidade/identidade.ts";
import type { Identidade } from "../identidade/identidade.ts";
import { credencialDoCabecalho } from "./credencial.ts";
import { ipDoVisitante, origemDeContaDeTeste } from "./origem.ts";
import { CREDITOS } from "../demonstracao/creditos.ts";
import { recusa, recusaDeAudioInvalido } from "./recusas.ts";
import { AnkiError } from "../importacao/anki.ts";

/**
 * O construtor do `Acervo` de **um** Usuário. As rotas o chamam por
 * requisição, com o `usuarioId` do Usuário que Entrou — decorado pelo hook da
 * Credencial —, e nunca guardam o `Acervo` de ninguém entre requisições
 * (FR-090, FR-092). A Interface do `Acervo` não muda: o que muda é o dono com
 * que ele é criado.
 */
export type AcervoDeUsuario = (usuarioId: string, contaDeTeste?: boolean) => Acervo;

/**
 * Adapter HTTP do Module `Acervo` (T007, T207, T403, T503 e T805).
 *
 * As rotas são finas por construção: validam a **forma** do corpo na borda
 * com Zod, **aguardam** a Interface do `Acervo` — que passou a ser assíncrona
 * porque a Porta de armazenamento é assíncrona — e traduzem o resultado em
 * código de status. Nenhuma regra de domínio é reproduzida aqui — vazio,
 * conteúdo só de espaços, limite de tamanho, unicidade de Vínculo e cascata de
 * exclusão continuam sendo julgados exclusivamente pelo `Acervo`. Na recusa de
 * domínio, o adapter apenas repassa o código estável e a mensagem em português
 * que o `Acervo` devolveu (FR-046), sem inventar texto próprio.
 *
 * O contrato HTTP não muda: 201, 200, 204, 400, 404 e 409 continuam sendo os
 * mesmos de `001` a `006`. O único acréscimo é o status da falha do
 * armazenamento, que FR-044 e FR-107 exigem reportar em vez de deixar a
 * operação passar por concluída — e que o Adapter do cliente já trata como
 * indisponibilidade.
 */

/**
 * Forma do corpo de `POST /cartoes` e `PUT /cartoes/{id}`: exatamente Frente
 * e Verso, ambos texto (FR-001). O esquema **não é estrito**: propriedade
 * extra é descartada na borda e nunca alcança o `Acervo` nem as leituras — a
 * verificação de FR-009. Forma inválida (corpo ausente, campo ausente, tipo
 * errado, JSON malformado) é recusada aqui, antes de qualquer chamada ao
 * `Acervo`.
 */
const corpoDeCartao = z.object({
  /** Tipo de cartão (`026`, FR-403); ausente é `frente-verso`, o padrão. */
  tipo: z.enum(["frente-verso", "imagem", "audio"]).optional(),
  frente: z.string(),
  verso: z.string(),
  tags: z.array(z.string()).optional(),
  /** No tipo `imagem`, o envio da Imagem a confirmar (FR-408). */
  imagemId: z.string().optional(),
  /** Descrição alternativa da Imagem (FR-412). */
  textoAlternativo: z.string().optional(),
  /** No tipo `audio`, o envio do Áudio a confirmar (`028`, FR-434). */
  audioId: z.string().optional(),
});

/**
 * Responde as recusas de criação e edição de Cartão comuns às duas rotas:
 * Imagem ou Áudio recusados são `422` com o motivo (FR-410, FR-411, FR-436);
 * tipo alterado na edição é `409` (FR-420); as demais regras de conteúdo são
 * `400`. Nenhuma resposta leva a Mensagem, o endereço ou o nome do arquivo
 * (FR-455).
 */
function responderRecusaDeCartao(
  resposta: FastifyReply,
  resultado: { erro: string; mensagem: string; motivo?: string; limite?: number },
) {
  if (resultado.erro === "imagem_invalida") {
    return resposta.status(422).send({
      erro: resultado.erro,
      motivo: resultado.motivo,
      mensagem: resultado.mensagem,
    });
  }

  if (resultado.erro === "audio_invalido") {
    return resposta
      .status(422)
      .send(recusaDeAudioInvalido(resultado.motivo as Parameters<typeof recusaDeAudioInvalido>[0]));
  }

  if (resultado.erro === "limite_de_midia_da_conta_de_teste") {
    return resposta.status(413).send(recusa("limite_de_midia_da_conta_de_teste", { limite: resultado.limite }));
  }

  const body: Record<string, unknown> = { erro: resultado.erro, mensagem: resultado.mensagem };
  if (resultado.limite !== undefined) {
    body.limite = resultado.limite;
  }
  return resposta
    .status(resultado.erro === "tipo_imutavel" ? 409 : 400)
    .send(body);
}

/**
 * FR-371 — forma do corpo de `POST /baralhos/de-selecao`: o `id` é o UUID
 * gerado pelo cliente uma vez por tentativa de salvar, `nome` segue as regras
 * de Baralho e `cartaoIds` é a seleção enviada. A validação semântica (UUID,
 * limites de `cartaoIds`, nome aparado) é do `Acervo`; aqui só a forma.
 */
const corpoDeSelecaoParaBaralho = z.object({
  id: z.string(),
  nome: z.string(),
  cartaoIds: z.array(z.string()),
  tags: z.array(z.string()).optional(),
});

/**
 * FR-374 — resposta de forma inválida ou de dados recusados pelo `Acervo`.
 * Única mensagem em inglês técnico para os dois casos, sem detalhar o motivo.
 */
const DADOS_DA_SELECAO_INVALIDOS = recusa("dados_invalidos");

/**
 * FR-374 — mensagem técnica em inglês do 409 de Cartões que não existem ou não são do Usuário.
 * A lista de ids acompanha a resposta e nunca revela dados alheios.
 */
const CARTOES_INDISPONIVEIS_MENSAGEM = recusa("cartoes_indisponiveis").mensagem;

/**
 * FR-374 — resposta técnica em inglês do 409 de colisão de `id` com outro Usuário; nada foi
 * gravado e a mesma tentativa pode ser repetida.
 */
const CONFLITO_DE_BARALHO = recusa("conflito");

/**
 * Forma do corpo de `POST /baralhos` e `PUT /baralhos/{id}`: exatamente o
 * nome, texto (FR-010). O esquema **não é estrito**: propriedade extra é
 * descartada na borda e nunca alcança o `Acervo` nem as leituras — a
 * verificação de FR-018. Forma inválida é recusada aqui, antes de qualquer
 * chamada ao `Acervo`.
 */
const corpoDeBaralho = z.object({
  nome: z.string(),
  tags: z.array(z.string()).optional(),
});

/**
 * Forma do corpo de `POST /usuarios`: exatamente o Nome de usuário e a Senha,
 * ambos texto (FR-071). O esquema **não é estrito**: propriedade extra — e a
 * Confirmação da Senha, que não faz parte deste contrato — é descartada na
 * borda e nunca alcança o `Identidade` (FR-072). Forma inválida é recusada aqui,
 * antes de qualquer chamada ao Module.
 */
const corpoDeUsuario = z.object({
  nomeDeUsuario: z.string(),
  senha: z.string(),
});

/**
 * Forma do corpo de `POST /sessoes`: o Registro de sessão que o cliente envia
 * ao concluir — o identificador que dá a idempotência, a Origem da Sessão
 * (`"baralho"` ou `"revisao"`), o Baralho e o seu nome no momento da conclusão
 * e a lista de Itens, cada um com Frente, Verso, Cartão de origem e Avaliação
 * (contrato da `015`, §4, FR-196).
 *
 * O esquema confere apenas a **forma**. Os limites de tamanho, a forma canônica
 * do identificador, o intervalo de 1 a 1000 Itens, a Origem conhecida, a
 * validade de Frente e Verso como Cartão, o Cartão de origem não vazio e a
 * Avaliação em um dos quatro níveis continuam sendo julgados exclusivamente
 * pelo `Acervo` (FR-161, FR-193, FR-196). O Resultado **não** vem do cliente:
 * ele é derivado da Avaliação lá (FR-194). Por isso a recusa de forma na borda
 * usa o **mesmo** código da recusa de domínio — `dados_invalidos` —, e o
 * cliente tem um só caminho para corpo inválido.
 */
const corpoDeRegistro = z.object({
  id: z.string(),
  /**
   * Identificador do Início autorizado pela Agenda, quando a Sessão foi iniciada
   * por um Compromisso (FR-254). A correspondência com o snapshot do servidor é
   * julgada pelo `Acervo`.
   */
  inicioAgendaId: z.string().optional(),
  origem: z.string(),
  baralhoId: z.string(),
  nomeDoBaralho: z.string(),
  itens: z.array(
    z.object({
      /** Tipo do Cartão estudado (`026`, FR-419a); ausente é `frente-verso`. */
      tipo: z.string().optional(),
      frente: z.string(),
      verso: z.string(),
      cartaoId: z.string(),
      avaliacao: z.string(),
    }),
  ),
});

/**
 * Forma da consulta de `GET /agenda`: o início da semana e o fuso IANA do
 * navegador (contrato da `016`). Datas e fuso válidos são julgados pelo
 * `Acervo`.
 */
const consultaDaAgenda = z.object({
  inicio: z.string(),
  fuso: z.string(),
});

/**
 * Forma do corpo de `POST /agenda/rotinas`: a intenção completa da operação
 * (contrato da `016`). O esquema confere só a forma; dias, quantidade, versão,
 * ação e fuso são julgados pelo `Acervo`, com o mesmo código `dados_invalidos`.
 */
const corpoDeRotina = z.object({
  operacaoId: z.string(),
  id: z.string().optional(),
  versao: z.number().optional(),
  acao: z.string(),
  baralhoId: z.string().optional(),
  dias: z.array(z.number()).optional(),
  quantidade: z.number().nullable().optional(),
  confirmarSobreposicao: z.boolean().optional(),
  fuso: z.string(),
});

/** Forma do corpo de `POST /agenda/inicios` (contrato da `016`). */
const corpoDeInicio = z.object({
  rotinaId: z.string(),
  data: z.string(),
  fuso: z.string(),
});

/**
 * Forma da consulta de `GET /estatisticas`: o `desde` da janela é um único
 * texto (contrato da `013`, §3). Ausente, repetido ou de outro tipo é recusado
 * na borda como `dados_invalidos`; se ele é um instante ISO-8601 utilizável
 * como limite, quem decide é o `Acervo` (FR-169).
 */
const consultaDaJanela = z.object({
  desde: z.string(),
});

/**
 * Forma do corpo de `POST /previas`: a lista de Cartões cuja prévia o estudo
 * livre quer mostrar (contrato da `015`, §4). O esquema confere apenas a forma;
 * o intervalo de 1 a 200 identificadores não vazios é julgado pelo `Acervo`
 * (FR-221), e por isso a recusa de forma usa o mesmo código da de domínio.
 */
const corpoDePrevias = z.object({
  cartaoIds: z.array(z.string()),
});

/**
 * Forma do corpo de `POST /acervo/transicao-cartoes`: a lista de escolhas
 * para resolver Cartões com múltiplos Baralhos. O esquema confere apenas a
 * forma; a validação semântica é feita pelo `Acervo`.
 */
const corpoDeTransicao = z.object({
  escolhas: z.array(
    z.object({
      cartaoId: z.string(),
      baralhoId: z.string(),
    }),
  ),
});

/**
 * Forma do corpo de `PUT /preferencias`: o algoritmo (contrato da `015`, §4).
 * O esquema confere apenas a forma; o algoritmo disponível é julgado pelo
 * `Acervo` (FR-212). Campos a mais, como o antigo limite de Cartões novos por
 * dia, são ignorados.
 */
const corpoDePreferencias = z.object({
  algoritmo: z.string(),
});

/**
 * Recusa uniforme de forma inválida na borda. Regra de domínio exige mensagem
 * útil ao usuário; forma inválida não — mas a resposta é estável e em
 * inglês técnico para debugging (FR-046, FR-018). O código `corpo_invalido` não é
 * código de regra de Cartão: ele não aparece na tabela do contrato.
 */
export const CORPO_INVALIDO = recusa("corpo_invalido");

/**
 * Status da falha do armazenamento: o serviço não conseguiu ler nem gravar, e
 * a operação **não** foi concluída (FR-044, FR-045).
 */
const INDISPONIVEL = 503;

/**
 * Recusas das rotas de Histórico, cada uma com o código estável e a mensagem
 * em inglês técnico — a mesma forma `{ erro, mensagem }` de todas as demais rotas
 * (FR-046, FR-018).
 *
 * Os resultados desta feature carregam apenas o código (contrato da `013`), e
 * quem traduz a falha em frase para a tela é o cliente; ainda assim a resposta
 * carrega a mensagem, porque é ela que o Adapter do cliente exige em toda
 * recusa (FR-044). O isolamento por Usuário faz o registro alheio se comportar
 * como inexistente, e é `nao_encontrado` que a leitura de um registro de outro
 * Usuário recebe (FR-166, FR-179).
 */
const DADOS_DO_REGISTRO_INVALIDOS = recusa("dados_invalidos");
const REGISTRO_EM_CONFLITO = recusa("conflito");
const REGISTRO_NAO_ENCONTRADO = recusa("nao_encontrado");
const INDISPONIVEL_DO_ARMAZENAMENTO = recusa("indisponivel");

/**
 * Recusas das rotas de Revisão e de Preferências (contrato da `015`, §4), na
 * mesma forma `{ erro, mensagem }` das demais, em inglês técnico. Como nas rotas de Histórico, o
 * corpo carrega só o código estável, e é o Adapter do cliente que o traduz em
 * frase para a tela (FR-044, FR-018).
 */
const DADOS_DA_REVISAO_INVALIDOS = recusa("dados_invalidos");
const DADOS_DAS_PREFERENCIAS_INVALIDOS = recusa("dados_invalidos");

/**
 * Responde a falha do armazenamento com o código estável e a mensagem técnica
 * em inglês que o `Acervo` produziu, e com nada mais: nenhum detalhe do
 * driver, caminho de arquivo, URL, senha ou cadeia de conexão atravessa a
 * resposta (FR-107, FR-108).
 */
function responderIndisponivel(
  resposta: FastifyReply,
  recusaBody: { erro: string; mensagem: string; limite?: number },
) {
  const body: Record<string, unknown> = {
    erro: recusaBody.erro,
    mensagem: recusaBody.mensagem,
  };
  if (recusaBody.limite !== undefined) {
    body.limite = recusaBody.limite;
  }
  return resposta.status(INDISPONIVEL).send(body);
}

/**
 * Registra as rotas de Cartão do contrato sobre o `Acervo` do Usuário que
 * Entrou: `GET /cartoes`, `PUT /cartoes/{id}` e `DELETE /cartoes/{id}`.
 * Chamada na inicialização, com o construtor do `Acervo` real, e nos testes
 * de contrato, com o `Acervo` sobre o Adapter do armazenamento local.
 *
 * O `Acervo` de quem Entrou é construído **dentro** de cada handler, a partir do
 * dono decorado na requisição pelo hook da Credencial: nenhum `Acervo` é
 * guardado entre requisições, e toda operação é, por construção, restrita ao
 * acervo de quem Entrou (FR-090, FR-092). Criação de Cartão agora é feita via
 * `POST /baralhos/{baralhoId}/cartoes` (FR-025).
 */
/** Caminho do envio de Imagem (`026`, contracts/http.md). */
export const CAMINHO_DOS_ENVIOS_DE_IMAGEM = "/imagens/envios";

/**
 * `POST /imagens/envios` prepara o envio de uma Imagem nova do Usuário, que o
 * navegador faz direto ao armazém (research R4). Sem armazém configurado, a
 * rota responde indisponível.
 */
export function registrarRotasDeImagens(
  servidor: FastifyInstance,
  imagens: ArmazemDeMidia | undefined,
  identidade?: Identidade,
): void {
  servidor.post(CAMINHO_DOS_ENVIOS_DE_IMAGEM, async (requisicao, resposta) => {
    if (imagens === undefined) {
      return responderIndisponivel(resposta, recusa("indisponivel"));
    }

    if (identidade !== undefined) {
      const reserva = await identidade.reservarEnvioDeMidia(requisicao.usuarioQueEntrou.id);
      if (reserva === "limite") return resposta.status(413).send(recusa("limite_de_midia_da_conta_de_teste", { limite: 30 }));
      if (reserva === "indisponivel") return responderIndisponivel(resposta, recusa("indisponivel"));
    }

    try {
      const { envioId, ...envio } = await imagens.prepararEnvio(
        requisicao.usuarioQueEntrou.id,
        "imagem",
      );

      return resposta.status(201).send({
        imagemId: envioId,
        ...envio,
        limiteEmBytes: LIMITE_DE_BYTES_DA_IMAGEM,
        formatos: FORMATOS_ACEITOS,
      });
    } catch {
      return responderIndisponivel(resposta, recusa("indisponivel"));
    }
  });
}

/** Caminho do envio de Áudio (`028`, contracts/http.md). */
export const CAMINHO_DOS_ENVIOS_DE_AUDIO = "/audios/envios";

/** Formatos de Áudio aceitos, na ordem em que o cliente os anuncia (FR-436). */
const FORMATOS_DE_AUDIO_ACEITOS: readonly FormatoDeAudio[] = [
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",
  "audio/wav",
];

/**
 * `POST /audios/envios` prepara o envio de um Áudio novo do Usuário, que o
 * navegador faz direto ao armazém, como a Imagem (research R4). Sem armazém
 * configurado, a rota responde indisponível.
 */
export function registrarRotasDeAudios(
  servidor: FastifyInstance,
  audios: ArmazemDeMidia | undefined,
  identidade?: Identidade,
): void {
  servidor.post(CAMINHO_DOS_ENVIOS_DE_AUDIO, async (requisicao, resposta) => {
    if (audios === undefined) {
      return responderIndisponivel(resposta, recusa("indisponivel"));
    }

    if (identidade !== undefined) {
      const reserva = await identidade.reservarEnvioDeMidia(requisicao.usuarioQueEntrou.id);
      if (reserva === "limite") return resposta.status(413).send(recusa("limite_de_midia_da_conta_de_teste", { limite: 30 }));
      if (reserva === "indisponivel") return responderIndisponivel(resposta, recusa("indisponivel"));
    }

    try {
      const { envioId, ...envio } = await audios.prepararEnvio(
        requisicao.usuarioQueEntrou.id,
        "audio",
      );

      return resposta.status(201).send({
        audioId: envioId,
        ...envio,
        limiteEmBytes: LIMITE_DE_BYTES_DO_AUDIO,
        limiteEmSegundos: LIMITE_DE_DURACAO_DO_AUDIO_EM_MS / 1000,
        formatos: FORMATOS_DE_AUDIO_ACEITOS,
      });
    } catch {
      return responderIndisponivel(resposta, recusa("indisponivel"));
    }
  });
}

export function registrarRotasDeCartoes(
  servidor: FastifyInstance,
  acervoDe: AcervoDeUsuario,
): void {
  servidor.get("/cartoes", async (requisicao) =>
    acervoDe(requisicao.usuarioQueEntrou.id).listarCartoes(),
  );

  servidor.put("/cartoes/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
    const corpo = corpoDeCartao.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id, requisicao.usuarioQueEntrou.contaDeTeste === true);
    const resultado = await acervo.editarCartao(id, corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      if (resultado.erro === "nao_encontrado") {
        return resposta.status(404).send({
          erro: resultado.erro,
          mensagem: resultado.mensagem,
        });
      }

      if (resultado.erro === "frente_duplicada") {
        return resposta.status(409).send({
          erro: resultado.erro,
          mensagem: resultado.mensagem,
        });
      }

      return responderRecusaDeCartao(resposta, resultado);
    }

    return resposta.status(200).send(resultado.cartao);
  });

  servidor.delete("/cartoes/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.excluirCartao(id);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      return resposta.status(404).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(204).send();
  });
}

/** Decodifica o nome enviado percent-encoded pelo cliente; mantém o valor cru quando não decodifica. */
function decodificarNome(valor: string): string {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

/**
 * Registra as rotas de Baralho do contrato sobre o `Acervo` de quem Entrou:
 * `POST /baralhos`, `GET /baralhos`, `GET /baralhos/{id}`, `PUT /baralhos/{id}`,
 * `DELETE /baralhos/{id}` e `POST /baralhos/{baralhoId}/cartoes`. Mesma estrutura
 * fina das demais rotas: o `Acervo` é construído em cada handler, a partir do
 * dono decorado na requisição pelo hook da Credencial (FR-090, FR-092), a
 * forma é validada na borda, a regra de domínio é julgada exclusivamente pelo
 * `Acervo`, e a recusa de domínio é repassada com o código estável e a
 * mensagem em português devolvidos pela Interface (FR-046). Vínculo é agora
 * criado implicitamente por `criarCartao` dentro de um Baralho (FR-025).
 */
export function registrarRotasDeBaralhos(
  servidor: FastifyInstance,
  acervoDe: AcervoDeUsuario,
  lerAnki?: (bytes: Buffer) => Promise<unknown>,
): void {
  servidor.post("/baralhos/importacoes/previa", async (requisicao, resposta) => {
    if (!Buffer.isBuffer(requisicao.body)) return resposta.status(400).send({ erro: "corpo_invalido", mensagem: "Request body is invalid." });
    const cabecalhoDoNome = requisicao.headers["x-file-name"];
    const nomeBruto = (Array.isArray(cabecalhoDoNome) ? cabecalhoDoNome[0] : cabecalhoDoNome) ?? "";
    const nomeDoArquivo = decodificarNome(nomeBruto).toLowerCase();
    if (nomeDoArquivo.endsWith(".colpkg") || nomeDoArquivo === "collection.apkg") return resposta.status(400).send({ erro: "corpo_invalido", mensagem: "Request body is invalid." });
    if (!nomeDoArquivo.endsWith(".apkg")) return resposta.status(400).send({ erro: "corpo_invalido", mensagem: "Request body is invalid." });
    if (!lerAnki) return resposta.status(501).send(recusa("indisponivel"));
    try { return resposta.send(await lerAnki(requisicao.body)); }
    catch (erro) {
      if (erro instanceof AnkiError) {
        return resposta.status(422).send(recusa(erro.codigo, { limite: erro.limite }));
      }
      return resposta.status(400).send(recusa("corpo_invalido"));
    }
  });

  servidor.post("/baralhos/importacoes", async (requisicao, resposta) => {
    const corpo = z.object({
      baralhos: z.array(z.object({
        nome: z.string(),
        cartoes: z.array(z.object({
          frente: z.string(), verso: z.string(), tags: z.array(z.string()).optional(),
        })),
      })),
    }).safeParse(requisicao.body);
    if (!corpo.success) return resposta.status(400).send(CORPO_INVALIDO);
    const resultado = await acervoDe(requisicao.usuarioQueEntrou.id).importarBaralhos(corpo.data.baralhos.map((b) => ({ nome: b.nome, cartoes: b.cartoes.map((c) => ({ ...c, tags: c.tags ?? [] })) })));
    if (!resultado.ok && resultado.erro === "indisponivel") return resposta.status(503).send({ erro: "indisponivel", mensagem: resultado.mensagem });
    return resultado.ok ? resposta.status(201).send({ ok: true }) : resposta.status(400).send({ erro: resultado.erro, mensagem: resultado.mensagem });
  });

  servidor.post("/baralhos", async (requisicao, resposta) => {
    const corpo = corpoDeBaralho.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.criarBaralho(corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      const body: Record<string, unknown> = {
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      };
      if ("limite" in resultado && typeof resultado.limite === "number") {
        body.limite = resultado.limite;
      }
      return resposta.status(400).send(body);
    }

    return resposta.status(201).send(resultado.baralho);
  });

  /**
   * FR-371 a FR-374 — `POST /baralhos/de-selecao`: cria, num gesto único, um
   * Baralho com Vínculos para os Cartões informados. O `id` enviado pelo
   * cliente torna o reenvio idempotente: o mesmo `id` devolve `200` com o mesmo
   * Baralho e nada é gravado de novo; um `id` novo devolve `201`. Corpo fora da
   * forma, nome inválido e dados recusados são `400`; Cartões indisponíveis e
   * colisão de `id` são `409`; falha do armazenamento é a indisponibilidade
   * vigente, sem gravação parcial.
   */
  servidor.post("/baralhos/de-selecao", async (requisicao, resposta) => {
    const corpo = corpoDeSelecaoParaBaralho.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DA_SELECAO_INVALIDOS);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.salvarSelecaoComoBaralho(corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      if (resultado.erro === "cartoes_indisponiveis") {
        return resposta.status(409).send({
          erro: resultado.erro,
          mensagem: CARTOES_INDISPONIVEIS_MENSAGEM,
          cartaoIds: resultado.cartaoIds,
        });
      }

      if (resultado.erro === "conflito") {
        return resposta.status(409).send(CONFLITO_DE_BARALHO);
      }

      if (resultado.erro === "dados_invalidos") {
        return resposta.status(400).send(DADOS_DA_SELECAO_INVALIDOS);
      }

      return resposta.status(400).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(resultado.novo ? 201 : 200).send(resultado.baralho);
  });

  servidor.get("/baralhos", async (requisicao) =>
    acervoDe(requisicao.usuarioQueEntrou.id).listarBaralhos(),
  );

  servidor.get("/baralhos/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.obterBaralho(id);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      return resposta.status(404).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(200).send(resultado.baralho);
  });

  servidor.put("/baralhos/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
    const corpo = corpoDeBaralho.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.renomearBaralho(id, corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      if (resultado.erro === "nao_encontrado") {
        return resposta.status(404).send({
          erro: resultado.erro,
          mensagem: resultado.mensagem,
        });
      }

      return resposta.status(400).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(200).send(resultado.baralho);
  });

  servidor.delete("/baralhos/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.excluirBaralho(id);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      return resposta.status(404).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(204).send();
  });

  /**
   * FR-025 — `POST /baralhos/{baralhoId}/cartoes`: cria um Cartão vinculado a um
   * Baralho em um gesto único. Frentes duplicadas no mesmo Baralho recebem
   * numeração automática (ex: "to walk (2)"). Mesma forma de Cartão, mesmo
   * código `frente_duplicada` quando há colisão.
   */
  servidor.post(
    "/baralhos/:baralhoId/cartoes",
    async (requisicao, resposta) => {
      const { baralhoId } = requisicao.params as { baralhoId: string };
      const corpo = corpoDeCartao.safeParse(requisicao.body);

      if (!corpo.success) {
        return resposta.status(400).send(CORPO_INVALIDO);
      }

      const acervo = acervoDe(requisicao.usuarioQueEntrou.id, requisicao.usuarioQueEntrou.contaDeTeste === true);
      const resultado = await acervo.criarCartao(baralhoId, corpo.data);

      if (!resultado.ok) {
        if (resultado.erro === "indisponivel") {
          return responderIndisponivel(resposta, resultado);
        }

        if (resultado.erro === "nao_encontrado") {
          return resposta.status(404).send({
            erro: resultado.erro,
            mensagem: resultado.mensagem,
          });
        }

        return responderRecusaDeCartao(resposta, resultado);
      }

      return resposta.status(201).send(resultado.cartao);
    },
  );
}

export function registrarRotasDeExportacao(
  servidor: FastifyInstance,
  acervoDe: AcervoDeUsuario,
): void {
  const idsOuTodos = z.union([z.literal("todos"), z.array(z.string().uuid()).min(1)]);
  const corpoPreviaExportacao = z.object({ formato: z.string(), baralhos: idsOuTodos });
  const corpoExportacao = corpoPreviaExportacao.extend({
    fuso: z.string(),
    idioma: z.enum(["pt", "en", "es"]),
  });
  const recusaExportacao = (resposta: FastifyReply, resultado: { erro: string; motivo?: string; limite?: number }) => {
    const status = resultado.erro === "dados_invalidos" ? 400
      : resultado.erro === "nao_encontrado" ? 404
      : resultado.erro === "exportacao_vazia" || resultado.erro === "exportacao_grande_demais" ? 422
      : 503;
    return resposta.status(status).send(recusa(resultado.erro as Parameters<typeof recusa>[0], {
      ...(resultado.motivo ? { motivo: resultado.motivo } : {}),
      ...(resultado.limite === undefined ? {} : { limite: resultado.limite }),
    }));
  };

  servidor.post("/exportacoes/previa", async (requisicao, resposta) => {
    const corpo = corpoPreviaExportacao.safeParse(requisicao.body);
    if (!corpo.success) return resposta.status(400).send(CORPO_INVALIDO);
    const resultado = await acervoDe(requisicao.usuarioQueEntrou.id).previaDaExportacao(corpo.data);
    return resultado.ok ? resposta.send(resultado.previa) : recusaExportacao(resposta, resultado);
  });

  servidor.post("/exportacoes", async (requisicao, resposta) => {
    const corpo = corpoExportacao.safeParse(requisicao.body);
    if (!corpo.success) return resposta.status(400).send(CORPO_INVALIDO);
    const resultado = await acervoDe(requisicao.usuarioQueEntrou.id).exportar(corpo.data);
    return resultado.ok ? resposta.status(201).send({
      url: resultado.url,
      nomeDoArquivo: resultado.nomeDoArquivo,
      expiraEm: resultado.expiraEm,
      baralhos: resultado.baralhos,
      cartoes: resultado.cartoes,
      cartoesSemMidia: resultado.cartoesSemMidia,
    }) : recusaExportacao(resposta, resultado);
  });
}

/**
 * Registra as rotas de transição de Cartões do contrato sobre o `Acervo` de
 * quem Entrou: `GET /acervo/transicao-cartoes` e `POST /acervo/transicao-cartoes`
 * (FR-397, specs/025-criar-cartoes-baralho/contracts/http.md).
 *
 * Mesma estrutura das demais rotas: a Credencial é exigida (FR-090), o `Acervo`
 * é construído em cada handler com o dono decorado (FR-092), a forma é validada
 * na borda, e a recusa de domínio é repassada com código estável e mensagem em
 * português (FR-046).
 */
export function registrarRotasDeTransicao(
  servidor: FastifyInstance,
  acervoDe: AcervoDeUsuario,
): void {
  servidor.get(
    "/acervo/transicao-cartoes",
    async (requisicao, resposta) => {
      const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
      const resultado = await acervo.obterTransicao();

      if (!resultado.ok) {
        return responderIndisponivel(resposta, resultado);
      }

      return resposta.status(200).send({
        cartoes: resultado.cartoes,
        baralhos: resultado.baralhos,
      });
    },
  );

  servidor.post(
    "/acervo/transicao-cartoes",
    async (requisicao, resposta) => {
      const corpo = corpoDeTransicao.safeParse(requisicao.body);

      if (!corpo.success) {
        return resposta.status(400).send(recusa("escolhas_invalidas"));
      }

      const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
      const resultado = await acervo.concluirTransicao(corpo.data);

      if (!resultado.ok) {
        if (resultado.erro === "indisponivel") {
          return responderIndisponivel(resposta, resultado);
        }

        if (resultado.erro === "conflito") {
          return resposta.status(409).send({
            erro: resultado.erro,
            mensagem: resultado.mensagem,
          });
        }

        return resposta.status(400).send({
          erro: resultado.erro,
          mensagem: resultado.mensagem,
        });
      }

      return resposta.status(204).send();
    },
  );
}

/**
 * Registra as rotas de Histórico do contrato sobre o `Acervo` de quem Entrou:
 * `POST /sessoes`, `GET /estatisticas` e `GET /sessoes/{id}`
 * (`specs/013-estatisticas-e-historico/contracts/contratos.md`, §3).
 *
 * Mesma estrutura fina das rotas de Baralho: a Credencial já foi exigida pelo
 * hook `onRequest` (FR-090), o `Acervo` é construído **dentro** de cada handler
 * com o dono decorado na requisição, de modo que nenhum acervo é guardado entre
 * requisições e toda operação é restrita ao Histórico de quem Entrou (FR-092);
 * a forma é validada na borda com Zod e as regras de domínio são julgadas
 * exclusivamente pelo `Acervo` (FR-161). A recusa de domínio atravessa como
 * código, sem texto: é o cliente que a traduz em frase.
 *
 * O `POST /sessoes` é **idempotente** pelo `id` (FR-163): a primeira gravação
 * responde `201`; o reenvio do mesmo `id` devolve o registro guardado e
 * responde `200`. A distinção é feita sem estado — o registro devolvido carrega
 * a data da **primeira** gravação, e uma data anterior ao início desta
 * requisição só pode vir de um registro que já existia.
 */
export function registrarRotasDeSessoes(
  servidor: FastifyInstance,
  acervoDe: AcervoDeUsuario,
): void {
  servidor.post("/sessoes", async (requisicao, resposta) => {
    const corpo = corpoDeRegistro.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DO_REGISTRO_INVALIDOS);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.registrarSessao(corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "dados_invalidos") {
        return resposta.status(400).send(DADOS_DO_REGISTRO_INVALIDOS);
      }

      if (resultado.erro === "conflito") {
        return resposta.status(409).send(REGISTRO_EM_CONFLITO);
      }

      return resposta.status(INDISPONIVEL).send(INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    // O reenvio do mesmo `id` responde 200 com o Registro guardado; a criação,
    // 201 (FR-163). Quem diz qual dos dois foi é o `Acervo`, sem olhar o relógio.
    return resposta
      .status(resultado.criada ? 201 : 200)
      .send(resultado.registro);
  });

  servidor.get("/estatisticas", async (requisicao, resposta) => {
    const consulta = consultaDaJanela.safeParse(requisicao.query);

    if (!consulta.success) {
      return resposta.status(400).send(DADOS_DO_REGISTRO_INVALIDOS);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.obterEstatisticas(consulta.data.desde);

    if (!resultado.ok) {
      if (resultado.erro === "dados_invalidos") {
        return resposta.status(400).send(DADOS_DO_REGISTRO_INVALIDOS);
      }

      return resposta.status(INDISPONIVEL).send(INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta.status(200).send(resultado.estatisticas);
  });

  servidor.get("/sessoes/:id", async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string };
    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.obterRegistroDeSessao(id);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return resposta
          .status(INDISPONIVEL)
          .send(INDISPONIVEL_DO_ARMAZENAMENTO);
      }

      return resposta.status(404).send(REGISTRO_NAO_ENCONTRADO);
    }

    return resposta.status(200).send({
      registro: resultado.registro,
      baralhoExiste: resultado.baralhoExiste,
    });
  });
}

/**
 * Código HTTP de cada recusa da Agenda (contrato da `016`): entrada inválida
 * 400, recurso ausente — ou de outro dono — 404, versão ou estado em conflito
 * 409, sobreposição a confirmar 409 e armazenamento indisponível 503. O corpo é
 * sempre `{ erro, mensagem }`, com a mensagem em português do `Acervo`.
 */
/**
 * O corpo da recusa da Agenda: código, `motivo` e, na sobreposição, os dias em
 * comum, para a interface montar o texto no idioma da pessoa (027, FR-019).
 */
function corpoDaRecusaDaAgenda(falha: {
  erro: string;
  mensagem: string;
  motivo?: string;
  dias?: number[];
}): Record<string, unknown> {
  return {
    erro: falha.erro,
    mensagem: falha.mensagem,
    ...(falha.motivo !== undefined ? { motivo: falha.motivo } : {}),
    ...(falha.dias !== undefined ? { dias: falha.dias } : {}),
  };
}

const STATUS_DA_AGENDA = {
  dados_invalidos: 400,
  nao_encontrado: 404,
  conflito: 409,
  sobreposicao: 409,
  indisponivel: INDISPONIVEL,
} as const;

const DADOS_DA_AGENDA_INVALIDOS = recusa("dados_invalidos");

/**
 * Registra as rotas da Agenda de estudo sobre o `Acervo` de quem Entrou:
 * `GET /agenda`, `GET /agenda/rotinas`, `POST /agenda/rotinas` e
 * `POST /agenda/inicios` (contrato da `016`).
 *
 * Mesma estrutura fina das demais rotas: a Credencial já foi exigida pelo hook
 * (FR-090), o `Acervo` é construído **dentro** de cada handler com o dono da
 * requisição — o `usuarioId` nunca vem do corpo (FR-248) — e toda regra é
 * julgada pelo `Acervo`. `POST /agenda/rotinas` responde 201 ao **criar** e 200
 * nas demais ações e no reenvio idempotente (FR-249).
 */
export function registrarRotasDeAgenda(
  servidor: FastifyInstance,
  acervoDe: AcervoDeUsuario,
): void {
  servidor.get("/agenda", async (requisicao, resposta) => {
    const consulta = consultaDaAgenda.safeParse(requisicao.query);

    if (!consulta.success) {
      return resposta.status(400).send(DADOS_DA_AGENDA_INVALIDOS);
    }

    const resultado = await acervoDe(
      requisicao.usuarioQueEntrou.id,
    ).obterAgenda(consulta.data.inicio, consulta.data.fuso);

    if (!resultado.ok) {
      return resposta
        .status(STATUS_DA_AGENDA[resultado.erro])
        .send(corpoDaRecusaDaAgenda(resultado));
    }

    return resposta.status(200).send(resultado.agenda);
  });

  servidor.get("/agenda/rotinas", async (requisicao, resposta) => {
    const resultado = await acervoDe(
      requisicao.usuarioQueEntrou.id,
    ).listarRotinas();

    if (!resultado.ok) {
      return resposta
        .status(STATUS_DA_AGENDA[resultado.erro])
        .send(corpoDaRecusaDaAgenda(resultado));
    }

    return resposta.status(200).send({ rotinas: resultado.rotinas });
  });

  servidor.post("/agenda/rotinas", async (requisicao, resposta) => {
    const corpo = corpoDeRotina.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DA_AGENDA_INVALIDOS);
    }

    const { acao, ...resto } = corpo.data;
    const resultado = await acervoDe(
      requisicao.usuarioQueEntrou.id,
    ).salvarRotina({ ...resto, acao: acao as AcaoDeRotina });

    if (!resultado.ok) {
      return resposta
        .status(STATUS_DA_AGENDA[resultado.erro])
        .send(corpoDaRecusaDaAgenda(resultado));
    }

    return resposta
      .status(resultado.criada ? 201 : 200)
      .send({ rotina: resultado.rotina });
  });

  servidor.post("/agenda/inicios", async (requisicao, resposta) => {
    const corpo = corpoDeInicio.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DA_AGENDA_INVALIDOS);
    }

    const resultado = await acervoDe(
      requisicao.usuarioQueEntrou.id,
    ).iniciarCompromisso(corpo.data);

    if (!resultado.ok) {
      return resposta
        .status(STATUS_DA_AGENDA[resultado.erro])
        .send(corpoDaRecusaDaAgenda(resultado));
    }

    return resposta.status(201).send({ inicio: resultado.inicio });
  });
}

/**
 * Registra a rota de repetição espaçada do contrato sobre o `Acervo` de quem
 * Entrou: `POST /previas` (contrato da `015`, §4). A Revisão do dia
 * (`GET /revisao` e `GET /revisao/lote`) saiu da aplicação.
 *
 * Mesma estrutura fina das demais rotas: a Credencial já foi exigida pelo hook
 * `onRequest` (FR-090), o `Acervo` é construído **dentro** do handler com o
 * dono decorado na requisição, de modo que a prévia de um Usuário nunca
 * alcança os Cartões de outro (FR-219); a forma é validada na borda com Zod, e
 * o teto de 200 identificadores é julgado exclusivamente pelo `Acervo`
 * (FR-221). A
 * recusa de domínio atravessa com o **mesmo** código da recusa de forma —
 * `dados_invalidos` —, de modo que o cliente tem um só caminho para entrada
 * inválida.
 */
export function registrarRotasDeRevisao(
  servidor: FastifyInstance,
  acervoDe: AcervoDeUsuario,
): void {
  servidor.post("/previas", async (requisicao, resposta) => {
    const corpo = corpoDePrevias.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DA_REVISAO_INVALIDOS);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.obterPrevias(corpo.data.cartaoIds);

    if (!resultado.ok) {
      if (resultado.erro === "dados_invalidos") {
        return resposta.status(400).send(DADOS_DA_REVISAO_INVALIDOS);
      }

      return resposta
        .status(INDISPONIVEL)
        .send(INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta.status(200).send({ previas: resultado.previas });
  });
}

/**
 * Registra as rotas de Preferências do contrato sobre o `Acervo` de quem
 * Entrou: `GET /preferencias` e `PUT /preferencias` (contrato da `015`, §4).
 *
 * O `PUT` responde com o **mesmo** corpo do `GET` — o algoritmo e o limite
 * salvos mais a lista de algoritmos disponíveis —, para que a tela de
 * Preferências se redesenhe com uma única leitura (FR-212). O algoritmo
 * desconhecido e o limite fora do inteiro de 0 a 999 são recusados pelo `Acervo`
 * como `dados_invalidos`, e a troca de algoritmo dispara lá a reconstrução dos
 * Agendamentos (FR-200, FR-213).
 */
export function registrarRotasDePreferencias(
  servidor: FastifyInstance,
  acervoDe: AcervoDeUsuario,
): void {
  servidor.get("/preferencias", async (requisicao, resposta) => {
    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.obterPreferencias();

    if (!resultado.ok) {
      return resposta
        .status(INDISPONIVEL)
        .send(INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta.status(200).send(resultado.preferencias);
  });

  servidor.put("/preferencias", async (requisicao, resposta) => {
    const corpo = corpoDePreferencias.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DAS_PREFERENCIAS_INVALIDOS);
    }

    const acervo = acervoDe(requisicao.usuarioQueEntrou.id);
    const resultado = await acervo.salvarPreferencias(corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "dados_invalidos") {
        return resposta.status(400).send(DADOS_DAS_PREFERENCIAS_INVALIDOS);
      }

      return resposta
        .status(INDISPONIVEL)
        .send(INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta.status(200).send(resultado.preferencias);
  });
}

/**
 * Registra a rota de Usuário do contrato sobre o `Identidade` informado:
 * `POST /usuarios`. A rota é uma casca fina sobre a Interface, como as demais:
 * valida a **forma** do corpo na borda com Zod, **aguarda** o `cadastrar` do
 * Module e converte o código de erro em status — 400 para as recusas de regra,
 * 409 para o Nome de usuário já existente, 503 para a falha do armazenamento —,
 * repassando o código estável e a mensagem em português que o Module devolveu
 * (FR-046). Nenhuma regra de domínio é reproduzida aqui: o tamanho, o alfabeto,
 * o intervalo da Senha e a unicidade sem distinção entre maiúsculas e
 * minúsculas continuam sendo julgados exclusivamente pelo `Identidade`
 * (FR-070, SC-026).
 *
 * A resposta de sucesso carrega apenas `id` e `nomeDeUsuario`: **nenhuma
 * resposta contém a Senha, qualquer transformação dela ou credencial
 * reutilizável**, e nenhuma traz `Set-Cookie` (FR-076, FR-078, FR-079).
 */
export function registrarRotasDeUsuarios(
  servidor: FastifyInstance,
  identidade: Identidade,
): void {
  servidor.post("/usuarios", async (requisicao, resposta) => {
    const corpo = corpoDeUsuario.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

    const resultado = await identidade.cadastrar(corpo.data);

    if (!resultado.ok) {
      if (resultado.erro === "indisponivel") {
        return responderIndisponivel(resposta, resultado);
      }

      if (resultado.erro === "nome_de_usuario_existente") {
        return resposta.status(409).send({
          erro: resultado.erro,
          mensagem: resultado.mensagem,
        });
      }

      return resposta.status(400).send({
        erro: resultado.erro,
        mensagem: resultado.mensagem,
      });
    }

    return resposta.status(201).send(resultado.usuario);
  });
}

/**
 * Forma do corpo de `POST /contas-de-teste` (030): o fuso IANA e o idioma do
 * visitante. A validade do fuso é julgada pelo `Identidade`; o idioma é
 * conferido aqui, na borda, contra a lista fechada.
 */
const corpoDeContaDeTeste = z.object({
  fuso: z.string(),
  idioma: z.enum(["pt", "en", "es"]),
});

/**
 * Registra as rotas de Entrar como Teste (030): `POST /contas-de-teste`, sem
 * Credencial, e `GET /demonstracao/creditos`, público.
 *
 * A criação cria a Conta de teste pelo `Identidade`, revoga o Acesso deste
 * navegador (como `POST /entrar`) e emite um novo com o cookie. A origem vai ao
 * `Identidade` só como HMAC (R5); o IP nunca é lido para log.
 */
export function registrarRotasDeContaDeTeste(
  servidor: FastifyInstance,
  identidade: Identidade,
  acessos: Acessos,
): void {
  servidor.post("/contas-de-teste", async (requisicao, resposta) => {
    const corpo = corpoDeContaDeTeste.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

    const subchave = servidor.subchaveDeOrigemDeContaDeTeste;

    // Sem o segredo, a origem não pode ser contada: nenhuma conta é criada.
    if (subchave === null) {
      return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    const criada = await identidade.criarContaDeTeste({
      fuso: corpo.data.fuso,
      idioma: corpo.data.idioma,
      origem: origemDeContaDeTeste(subchave, ipDoVisitante(requisicao)),
    });

    if (!criada.ok) {
      if (criada.erro === "dados_invalidos") {
        return resposta.status(400).send(CORPO_INVALIDO);
      }

      if (criada.erro === "esgotadas_na_origem") {
        return resposta.status(429).send(recusa("contas_de_teste_esgotadas_na_origem", { limite: 10 }));
      }
      if (criada.erro === "contas_esgotadas") {
        return resposta.status(503).send(recusa("contas_de_teste_indisponiveis"));
      }
      return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    // O novo Acesso substitui o deste navegador, como em `POST /entrar` (D4, A2).
    const valorAtual = acessos.valorDoCookie(requisicao.headers.cookie);
    const revogado = await acessos.encerrar(valorAtual);

    if (!revogado.ok) {
      return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    const emitido = await acessos.emitir(criada.usuario.id);

    if (!emitido.ok) {
      return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta
      .header("set-cookie", acessos.cookieDeAcesso(emitido.valor))
      .status(201)
      .send({
        nomeDeUsuario: criada.usuario.nomeDeUsuario,
        contaDeTeste: true,
      });
  });

  servidor.get("/demonstracao/creditos", async (_requisicao, resposta) =>
    resposta.status(200).send(
      CREDITOS.map(
        ({ baralho, cartao, titulo, autor, licenca, fonte }) => ({
          baralho,
          cartao,
          titulo,
          autor,
          licenca,
          fonte,
        }),
      ),
    ),
  );
}

/**
 * Forma dos corpos das rotas de conta (017): textos, e nada mais é exigido na
 * borda. O intervalo e a Senha atual são julgados exclusivamente pelo
 * `Identidade`; forma inválida usa o mesmo código `dados_invalidos` da recusa
 * de regra, para o cliente ter um só caminho.
 */
const corpoDeTrocaDeSenha = z.object({
  senhaAtual: z.string(),
  novaSenha: z.string(),
  confirmacaoDaSenha: z.string(),
});
const corpoDeExclusaoDeConta = z.object({
  senhaAtual: z.string(),
});

const DADOS_DA_CONTA_INVALIDOS = recusa("dados_invalidos");

/**
 * Traduz a recusa da gestão da conta em resposta: `400` para regra violada,
 * `403` para a Senha atual incorreta — e não `401`, que é reservado à Credencial
 * recusada e dispararia o descarte da Credencial (FR-091, FR-279) — e `503`
 * para a falha do armazenamento. A resposta carrega apenas código, mensagem,
 * campo e opcionalmente limite: nunca a Senha (FR-078).
 */
function responderRecusaDeConta(
  resposta: FastifyReply,
  recusaBody: {
    erro: string;
    mensagem: string;
    campo?: string;
    limite?: number;
  },
) {
  const status =
    recusaBody.erro === "senha_atual_incorreta"
      ? 403
      : recusaBody.erro === "conta_de_teste"
        ? 403
      : recusaBody.erro === "indisponivel"
        ? INDISPONIVEL
        : 400;

  const body: Record<string, unknown> = {
    erro: recusaBody.erro,
    mensagem: recusaBody.mensagem,
  };
  if (recusaBody.campo !== undefined) {
    body.campo = recusaBody.campo;
  }
  if (recusaBody.limite !== undefined) {
    body.limite = recusaBody.limite;
  }
  return resposta.status(status).send(body);
}

/**
 * Registra as rotas de gestão da conta do Usuário (017): `GET /conta`,
 * `PUT /conta/senha` e `DELETE /conta`. Operam sempre sobre o Usuário da
 * Credencial apresentada, que o hook decorou na requisição — não há como
 * alcançar a conta de outro Usuário (FR-287).
 *
 * `PUT /conta/nome-de-usuario` não existe mais (020): a rota antiga **não é
 * registrada**, e uma requisição autenticada a ela recebe o `404` padrão do
 * roteador — a alteração do Nome de usuário saiu do contrato.
 */
export function registrarRotasDeConta(
  servidor: FastifyInstance,
  identidade: Identidade,
  acessos: Acessos,
): void {
  /**
   * 018 (FR-296): trocar a Senha **encerra todos os Acessos** do Usuário —
   * outros navegadores incluídos — e, quando a requisição foi autenticada por
   * Acesso, emite um Acesso **novo** para este navegador, que segue operando
   * sem Entrar de novo. Devolve `false` quando o armazenamento falha: a mudança
   * já foi aplicada, mas os Acessos antigos podem continuar valendo, e a
   * resposta não pode ser de sucesso.
   */
  async function renovarOsAcessos(
    requisicao: FastifyRequest,
    resposta: FastifyReply,
  ): Promise<boolean> {
    const usuarioId = requisicao.usuarioQueEntrou.id;
    const encerrados = await acessos.encerrarTodosDoUsuario(usuarioId);

    if (!encerrados.ok) {
      return false;
    }

    if (requisicao.acessoDaRequisicao === null) {
      return true;
    }

    const emitido = await acessos.emitir(usuarioId);

    if (!emitido.ok) {
      return false;
    }

    resposta.header("set-cookie", acessos.cookieDeAcesso(emitido.valor));

    return true;
  }

  servidor.get("/conta", async (requisicao, resposta) => {
    const resultado = await identidade.obterConta(
      requisicao.usuarioQueEntrou.id,
    );

    if (!resultado.ok) {
      return responderIndisponivel(resposta, resultado);
    }

    /** A marca de Conta de teste (030) vem do Usuário, lido pela Interface. */
    const usuario = await identidade.obterUsuario(
      requisicao.usuarioQueEntrou.id,
    );

    if (!usuario.ok) {
      return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta.status(200).send({
      nomeDeUsuario: resultado.conta.nomeDeUsuario,
      contagens: resultado.conta.contagens,
      contaDeTeste: usuario.usuario.contaDeTeste,
    });
  });

  servidor.put("/conta/senha", async (requisicao, resposta) => {
    const corpo = corpoDeTrocaDeSenha.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DA_CONTA_INVALIDOS);
    }

    const resultado = await identidade.trocarSenha(
      requisicao.usuarioQueEntrou.id,
      corpo.data,
    );

    if (!resultado.ok) {
      return responderRecusaDeConta(resposta, resultado);
    }

    if (!(await renovarOsAcessos(requisicao, resposta))) {
      return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta.status(204).send();
  });

  servidor.delete("/conta", async (requisicao, resposta) => {
    const corpo = corpoDeExclusaoDeConta.safeParse(requisicao.body);

    if (!corpo.success) {
      return resposta.status(400).send(DADOS_DA_CONTA_INVALIDOS);
    }

    const resultado = await identidade.excluirConta(
      requisicao.usuarioQueEntrou.id,
      corpo.data,
    );

    if (!resultado.ok) {
      return responderRecusaDeConta(resposta, resultado);
    }

    // Os Acessos caíram por cascata com o Usuário; o cookie deste navegador é
    // limpo, e nenhum Acesso novo é emitido (FR-296).
    return resposta
      .header("set-cookie", acessos.cookieDeLimpeza())
      .status(204)
      .send();
  });
}

/**
 * Forma do corpo **opcional** de `POST /entrar` (018): a Credencial pode vir pelo
 * corpo, além do cabeçalho, e `continuarConectado` — padrão `true` — decide se
 * um Acesso temporário é emitido (FR-292).
 */
const corpoDeEntrada = z.object({
  nomeDeUsuario: z.string().optional(),
  senha: z.string().optional(),
  continuarConectado: z.boolean().optional(),
});

/**
 * Registra a rota de Entrar do contrato: `POST /entrar`
 * (`specs/008-entrar/contracts/api-entrar.md`, estendido pela `018`).
 *
 * A rota é isenta do hook de Credencial: ela mesma verifica a Credencial — pelo
 * cabeçalho `Authorization: Basic` ou pelo corpo `{ nomeDeUsuario, senha }` —
 * com a mesma recusa única de sempre (FR-088), `401 credencial_invalida`, e
 * `503` quando o armazenamento falha (FR-044, FR-045).
 *
 * No sucesso, responde `200` com `id` e `nomeDeUsuario` — nunca a Senha, nunca o
 * Acesso no corpo (FR-078, FR-297). Com `continuarConectado` verdadeiro (o
 * padrão), **revoga** o Acesso do cookie atual, se houver, emite um novo e o
 * entrega em `Set-Cookie` `HttpOnly` (FR-289, FR-292); com `false`, revoga e
 * limpa o do cookie atual e **não** emite outro — a Credencial segue valendo só
 * na memória da página aberta (FR-090 revisado).
 */
export function registrarRotaDeEntrada(
  servidor: FastifyInstance,
  identidade: Identidade,
  acessos: Acessos,
): void {
  servidor.post("/entrar", async (requisicao, resposta) => {
    const corpo = corpoDeEntrada.safeParse(requisicao.body ?? {});

    if (!corpo.success) {
      return resposta.status(400).send(CORPO_INVALIDO);
    }

    const credencial =
      credencialDoCabecalho(requisicao.headers.authorization) ??
      (corpo.data.nomeDeUsuario !== undefined &&
      corpo.data.senha !== undefined
        ? {
            nomeDeUsuario: corpo.data.nomeDeUsuario,
            senha: corpo.data.senha,
          }
        : null);

    if (credencial === null) {
      return resposta.status(401).send(CREDENCIAL_INVALIDA);
    }

    const verificada = await identidade.autenticar(credencial);

    if (!verificada.ok) {
      if (verificada.erro === "indisponivel") {
        return responderIndisponivel(resposta, verificada);
      }

      return resposta.status(401).send(CREDENCIAL_INVALIDA);
    }

    const valorAtual = acessos.valorDoCookie(requisicao.headers.cookie);

    // O novo Entrar **substitui** o Acesso deste navegador: o anterior é
    // revogado antes de qualquer outro passo (D4, A2).
    const revogado = await acessos.encerrar(valorAtual);

    if (!revogado.ok) {
      return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    if (corpo.data.continuarConectado ?? true) {
      const emitido = await acessos.emitir(verificada.usuario.id);

      if (!emitido.ok) {
        return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
      }

      resposta.header("set-cookie", acessos.cookieDeAcesso(emitido.valor));
    } else if (valorAtual !== undefined) {
      resposta.header("set-cookie", acessos.cookieDeLimpeza());
    }

    return resposta.status(200).send({
      id: verificada.usuario.id,
      nomeDeUsuario: verificada.usuario.nomeDeUsuario,
    });
  });
}

/**
 * Registra as rotas do Acesso temporário (018): `GET /acesso`,
 * `POST /acesso/renovar` e `POST /sair`.
 *
 * Todas leem o cookie e respondem por conta própria — são isentas do hook —,
 * porque cada recusa tem o seu código e **limpa o cookie**, que é `HttpOnly` e
 * não pode ser apagado por script (A3): `401 sem_acesso` quando não há Acesso,
 * `401 acesso_expirado` quando a linha existe e venceu. A falha do
 * armazenamento é `503` e **nunca** limpa o cookie: não é expiração (FR-301).
 * O Acesso nunca aparece no corpo (FR-297, FR-305).
 */
export function registrarRotasDeAcesso(
  servidor: FastifyInstance,
  identidade: Identidade,
  acessos: Acessos,
): void {
  /** Valida e renova o Acesso do cookie e resolve o Usuário dele. */
  async function autorizarCookie(requisicao: FastifyRequest) {
    const autorizado = await acessos.autorizar(
      acessos.valorDoCookie(requisicao.headers.cookie),
    );

    if (!autorizado.ok) {
      return autorizado;
    }

    const usuario = await identidade.obterUsuario(autorizado.usuarioId);

    if (!usuario.ok) {
      return {
        ok: false as const,
        erro:
          usuario.erro === "indisponivel"
            ? ("indisponivel" as const)
            : ("sem_acesso" as const),
      };
    }

    return { ok: true as const, usuario: usuario.usuario };
  }

  function recusar(
    resposta: FastifyReply,
    erro: "sem_acesso" | "acesso_expirado" | "indisponivel",
  ) {
    if (erro === "indisponivel") {
      return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta
      .header("set-cookie", acessos.cookieDeLimpeza())
      .status(401)
      .send(erro === "acesso_expirado" ? ACESSO_EXPIRADO : SEM_ACESSO);
  }

  servidor.get("/acesso", async (requisicao, resposta) => {
    const autorizado = await autorizarCookie(requisicao);

    if (!autorizado.ok) {
      return recusar(resposta, autorizado.erro);
    }

    return resposta
      .status(200)
      .send({ nomeDeUsuario: autorizado.usuario.nomeDeUsuario });
  });

  servidor.post("/acesso/renovar", async (requisicao, resposta) => {
    const autorizado = await autorizarCookie(requisicao);

    if (!autorizado.ok) {
      return recusar(resposta, autorizado.erro);
    }

    return resposta.status(204).send();
  });

  servidor.post("/sair", async (requisicao, resposta) => {
    const autorizado = await autorizarCookie(requisicao);
    if (autorizado.ok && autorizado.usuario.contaDeTeste) {
      // Revoga-se o Acesso e limpa-se o cookie mesmo que a exclusão falhe;
      // a varredura agendada recolhe a Conta de teste órfã depois da folga.
      try {
        await acessos.encerrar(acessos.valorDoCookie(requisicao.headers.cookie));
      } catch {
        // O cookie local ainda precisa ser removido; a expiração do Acesso
        // no armazenamento é recuperada pela limpeza da Conta de teste.
      }
      try {
        await identidade.encerrarContaDeTeste(autorizado.usuario.id);
      } catch {
        // A Conta permanece marcada como descartável e será recolhida pelo
        // job de limpeza após expirar o Acesso.
      }
      return resposta.header("set-cookie", acessos.cookieDeLimpeza()).status(204).send();
    }
    const encerrado = await acessos.encerrar(
      acessos.valorDoCookie(requisicao.headers.cookie),
    );

    if (!encerrado.ok) {
      return responderIndisponivel(resposta, INDISPONIVEL_DO_ARMAZENAMENTO);
    }

    return resposta
      .header("set-cookie", acessos.cookieDeLimpeza())
      .status(204)
      .send();
  });
}
