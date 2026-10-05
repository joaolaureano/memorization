import type {
  ClienteDoAcervo,
  InicioDeCompromisso,
} from "../acervo-cliente/cliente";
import { AgendaDeEstudo } from "./AgendaDeEstudo";
import { EstadoDaCarga } from "./EstadoDaCarga";
import {
  PainelDaSemana,
  UltimasSessoes,
  useEstatisticasDoEstudo,
} from "./EstatisticasDoEstudo";

/**
 * A área Estudo (FR-312..FR-315, FR-319, FR-320): o destino «Estudo» da
 * navegação principal.
 *
 * A ordem dos blocos é a leitura da semana (FR-312). Primeiro o cabeçalho, com
 * as duas ações que levam a Agendar estudo e a Gerenciar rotinas; depois a
 * Agenda semanal (FR-313), que é o que ainda vai acontecer; e por fim o que já
 * aconteceu — as Estatísticas dos últimos sete dias (FR-314) e as últimas
 * Sessões (FR-315).
 *
 * Cada bloco tem estado próprio: a falha de uma leitura não esconde as outras,
 * e o que a Agenda conta não depende de as Estatísticas terem chegado. Os
 * estados de carga e de falha das Estatísticas vêm de
 * `useEstatisticasDoEstudo` — a mesma leitura que o Início usa —, e é dela a
 * releitura da volta à tela e da virada do dia (FR-319, FR-320), de modo que a
 * área Estudo acompanhe o calendário sem que ninguém recarregue nada.
 *
 * Não há «Ver todas» nem lista de Rotinas: a Agenda logo acima já é a porta da
 * semana, e repetir os Compromissos aqui seria contar duas vezes a mesma coisa.
 */
export function PaginaDaCentralDeEstudo({
  cliente,
  aoIniciarEstudo,
}: {
  cliente: ClienteDoAcervo;
  /** Entrega o início autorizado à casca, que abre a Sessão (FR-231). */
  aoIniciarEstudo?: (inicio: InicioDeCompromisso) => void;
}) {
  const { estado, tentarNovamente } = useEstatisticasDoEstudo(cliente);
  const dados = estado.dados;

  return (
    <div className="pagina pilha">
      <div className="cabecalho-da-pagina">
        <div>
          <h1>Estudo</h1>
          <p className="texto-secundario">
            Acompanhe a semana, seus resultados e as últimas Sessões.
          </p>
        </div>
        <div className="acoes">
          <a className="botao botao--primario" href="#/agenda/nova">
            Agendar estudo
          </a>
          <a className="botao botao--secundario" href="#/agenda">
            Gerenciar rotinas
          </a>
        </div>
      </div>

      <AgendaDeEstudo
        cliente={cliente}
        modo="semana"
        aoIniciarEstudo={aoIniciarEstudo}
      />

      <section className="pilha" aria-labelledby="titulo-das-estatisticas">
        <h2 id="titulo-das-estatisticas">Seu estudo nos últimos 7 dias</h2>

        {dados === null && estado.carregando ? (
          <EstadoDaCarga
            estado="carregando"
            mensagem="Carregando o seu estudo…"
          />
        ) : null}

        {dados === null && !estado.carregando && estado.falha !== null ? (
          <EstadoDaCarga
            estado="falha"
            mensagem={estado.falha}
            aoTentarNovamente={tentarNovamente}
          />
        ) : null}

        {dados !== null ? (
          <div className="pilha">
            {/* A falha aparece acima dos números que ela não derrubou: o painel
                anterior continua valendo até que uma leitura nova o substitua. */}
            {estado.falha !== null ? (
              <div role="alert" className="aviso aviso--erro">
                <p>
                  Não foi possível atualizar as Estatísticas. Os dados abaixo
                  podem estar desatualizados. {estado.falha}
                </p>
                <button
                  type="button"
                  className="botao botao--secundario"
                  onClick={tentarNovamente}
                >
                  Tentar novamente
                </button>
              </div>
            ) : null}

            {estado.carregando ? (
              <p role="status" className="carregando">
                Atualizando…
              </p>
            ) : null}

            <PainelDaSemana
              estatisticas={dados.estatisticas}
              agora={dados.agora}
            />
          </div>
        ) : null}
      </section>

      <section className="pilha" aria-labelledby="titulo-das-ultimas">
        <h2 id="titulo-das-ultimas">Últimas sessões</h2>

        {dados !== null ? (
          <UltimasSessoes recentes={dados.estatisticas.recentes} />
        ) : null}

        {dados === null && estado.carregando ? (
          <EstadoDaCarga
            estado="carregando"
            mensagem="Carregando as últimas Sessões…"
          />
        ) : null}

        {/* A repetição da leitura já está oferecida no bloco das Estatísticas:
            aqui a falha só se explica, sem um segundo botão (FR-318). */}
        {dados === null && !estado.carregando ? (
          <p className="texto-secundario">
            Não foi possível carregar as últimas Sessões.
          </p>
        ) : null}
      </section>
    </div>
  );
}
