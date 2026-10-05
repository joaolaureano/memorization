import { useCallback, useEffect, useState } from "react";

import type {
  ClienteDoAcervo,
  RegistroDeSessao,
} from "../acervo-cliente/cliente";
import { MENSAGEM_DE_SESSAO_NAO_ENCONTRADA } from "../acervo-cliente/cliente";
import { EstadoDaCarga } from "./EstadoDaCarga";
import { ResumoDaSessao } from "./ResumoDaSessao";

/**
 * A tela de um Registro do histórico (FR-166, FR-177..FR-179).
 *
 * Mostra a Sessão concluída como ela foi vivida: o nome do Baralho no momento
 * da conclusão, o instante local, e o resumo dos acertos e erros com os Itens
 * na ordem apresentada — tudo vindo do `RegistroDeSessao` (FR-177, FR-178).
 *
 * O Registro sobrevive à exclusão do Baralho (FR-166): quando ele já não
 * existe, em vez de um link quebrado a tela traz o selo "Baralho excluído",
 * que explica a ausência sem esconder o que foi estudado.
 *
 * A Revisão do dia não pertence a Baralho algum (FR-215): quando a `origem` é
 * "revisao", a tela mostra "Revisão do dia" no lugar do nome do Baralho e não
 * traz o selo nem o link, porque a ausência de Baralho é própria da Revisão —
 * anunciá-la como um Baralho apagado seria mentir sobre o Registro. Os
 * Registros de estudo livre e os anteriores à 015 seguem exatamente como antes
 * (FR-178, FR-197, FR-214).
 *
 * O estudo com baralho temporário também não pertence a Baralho: salvar a
 * seleção como Baralho depois não renomeia nem reclassifica o Registro
 * (FR-376).
 *
 * Um Registro inexistente — ou de outro Usuário, que o isolamento por
 * Credencial não devolve (FR-092) — não se apresenta como tela vazia: diz que
 * não o encontrou e oferece a volta para Estudo (FR-179, FR-323). A falha de
 * transporte é outra coisa: preserva a página e permite tentar de novo.
 */

/** O estado da leitura do Registro, do pedido à resposta (FR-177). */
type EstadoDoRegistro =
  | { estado: "carregando" }
  | { estado: "falha"; mensagem: string }
  | { estado: "ausente" }
  | { estado: "pronta"; registro: RegistroDeSessao; baralhoExiste: boolean };

export function PaginaDoRegistro({
  cliente,
  id,
}: {
  cliente: ClienteDoAcervo;
  id: string;
}) {
  const [registro, setRegistro] = useState<EstadoDoRegistro>({
    estado: "carregando",
  });

  const carregar = useCallback(async () => {
    setRegistro({ estado: "carregando" });

    const resultado = await cliente.obterRegistroDeSessao(id);

    if (resultado.ok) {
      setRegistro({
        estado: "pronta",
        registro: resultado.registro,
        baralhoExiste: resultado.baralhoExiste,
      });
    } else if (resultado.erro === "nao_encontrado") {
      // Ausência não é falha: é o único desfecho que a tela trata como
      // mensagem própria, em vez de oferecer repetição (FR-179).
      setRegistro({ estado: "ausente" });
    } else {
      setRegistro({ estado: "falha", mensagem: resultado.mensagem });
    }
  }, [cliente, id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const tentarNovamente = useCallback(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="pagina">
      <p className="voltar">
        <a href="#/estudo">← Voltar para Estudo</a>
      </p>

      {registro.estado === "carregando" ? (
        <EstadoDaCarga estado="carregando" mensagem="Carregando a Sessão…" />
      ) : null}

      {registro.estado === "falha" ? (
        <EstadoDaCarga
          estado="falha"
          mensagem={registro.mensagem}
          aoTentarNovamente={tentarNovamente}
        />
      ) : null}

      {registro.estado === "ausente" ? (
        <div role="alert" className="aviso aviso--erro">
          <p>{MENSAGEM_DE_SESSAO_NAO_ENCONTRADA}</p>
          <a className="botao botao--secundario" href="#/estudo">
            Voltar para Estudo
          </a>
        </div>
      ) : null}

      {registro.estado === "pronta" ? (
        <>
          <header className="cabecalho-da-pagina resumo__cabecalho">
            <div>
              <h1>Sessão concluída</h1>
              <p className="texto-secundario">
                {tituloDaSessao(registro.registro)}
              </p>
            </div>
          </header>

          <p className="texto-secundario">
            {instanteLocal(registro.registro.concluidaEm)}
          </p>

          {registro.registro.origem === "baralho" ? (
            <p>
              {registro.baralhoExiste ? (
                <a href={`#/baralhos/${registro.registro.baralhoId}`}>
                  Ver baralho
                </a>
              ) : (
                <span className="selo">Baralho excluído</span>
              )}
            </p>
          ) : null}

          <ResumoDaSessao
            itens={registro.registro.itens}
            origem={registro.registro.origem}
          />
        </>
      ) : null}
    </div>
  );
}

/** O nome próprio da Revisão do dia, exibido no lugar do Baralho (FR-215). */
const TITULO_DA_REVISAO = "Revisão do dia";

/** O nome do estudo com baralho temporário (FR-376). */
const TITULO_DO_TEMPORARIO = "Estudo com baralho temporário";

/**
 * O título do Registro: o nome do Baralho no estudo livre, o nome próprio da
 * Revisão do dia (FR-215) ou o do estudo com baralho temporário (FR-376).
 * Registros anteriores à 015 são de estudo livre e seguem trazendo o nome do
 * Baralho (FR-197).
 */
function tituloDaSessao(registro: RegistroDeSessao): string {
  return registro.origem === "revisao"
    ? TITULO_DA_REVISAO
    : registro.origem === "temporario"
      ? TITULO_DO_TEMPORARIO
      : registro.nomeDoBaralho;
}

/** A data e a hora locais de um instante, no formato curto de pt-BR (FR-177). */
function instanteLocal(instante: string): string {
  const quando = new Date(instante);

  // Um instante ilegível não pode derrubar a tela: mostramos o que veio.
  if (Number.isNaN(quando.getTime())) {
    return instante;
  }

  return quando.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
