import { useEffect, useRef, useState } from "react";

import type {
  BaralhoListado,
  ClienteDoAcervo,
} from "../acervo-cliente/cliente";
import { filtrarBaralhos } from "../acervo-cliente/busca-no-acervo";
import { EstadoDaCarga } from "./EstadoDaCarga";
import { hashDaRota } from "./navegacao";

/**
 * Tela de Baralhos (T2101; spec 021: FR-339–FR-343, FR-346, FR-347; spec 022:
 * FR-348, FR-350, FR-354–FR-358; spec 012 herdada em FR-140, FR-148 e FR-153).
 *
 * É **somente a lista**: a criação mora em `PaginaDoFormularioDeBaralho` e
 * começa apenas por ação da pessoa, pelo link "Criar baralho" (FR-140). A tela
 * consome exclusivamente a Interface `ClienteDoAcervo` — o Adapter (Http em
 * produção, EmMemoria em teste) chega por propriedade — e não reproduz nenhuma
 * regra de domínio: as mensagens exibidas são as que o cliente devolve, em
 * português (FR-046).
 *
 * A busca da spec 022 acrescenta, logo depois do cabeçalho, o painel de
 * `Buscar baralhos` e a faixa de resultados (FR-354): o painel e o "Limpar
 * filtros" aparecem **sempre** — também enquanto a lista carrega ou falha —,
 * de modo que se possa digitar sem esperar a rede e a ação não desapareça
 * justamente quando é precisa. A consulta é estado local da página e não é
 * zerada pelo "Tentar novamente": a releitura só refaz a leitura (FR-148).
 *
 * O texto casa por trecho contínuo, sem acentos e sem caixa, e a consulta
 * vazia não restringe (FR-348, FR-350); as contas ficam em `filtrarBaralhos`,
 * o Módulo puro compartilhado com a página de Cartões. Digitar só refiltra: a
 * tela nunca move o foco nem oferece botão de envio (FR-358).
 *
 * Carregando, falha e vazio vêm de `EstadoDaCarga` (FR-153, FR-347), e a
 * falha oferece "Tentar novamente", que relê a lista pela Interface (FR-148).
 * Quando há Baralhos mas nenhum satisfaz a consulta, a tela mostra "Nenhum
 * resultado encontrado" — distinto do acervo vazio, que continua convidando a
 * criar o primeiro Baralho (FR-356, FR-357). A contagem de resultados é
 * anunciada por `role="status"` (FR-355).
 *
 * Cada Baralho é uma linha compacta no mesmo vocabulário da lista de Cartões
 * (FR-339): o nome é texto somente leitura — nunca link, sem foco e sem ação
 * ao clique (FR-341) —, a contagem aparece logo abaixo e as ações ficam à
 * direita, na ordem Estudar → Editar (FR-340). Editar abre o detalhe do
 * Baralho, o destino que o antigo clique no nome alcançava (FR-342).
 */

interface PropriedadesDaPaginaDeBaralhos {
  cliente: ClienteDoAcervo;
}

export function PaginaDeBaralhos({
  cliente,
}: PropriedadesDaPaginaDeBaralhos) {
  const [baralhos, setBaralhos] = useState<BaralhoListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhaDeListagem, setFalhaDeListagem] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [consulta, setConsulta] = useState("");

  const campoDeBusca = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ativo = true;

    setCarregando(true);
    setFalhaDeListagem(null);

    void cliente.listarBaralhos().then((resultado) => {
      if (!ativo) {
        return;
      }

      if (resultado.ok) {
        setBaralhos(resultado.baralhos);
      } else {
        setFalhaDeListagem(resultado.mensagem);
      }

      setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [cliente, tentativa]);

  /**
   * Relê a lista pela Interface: é a ação "Tentar novamente" da falha
   * (FR-148). Nenhuma mensagem é inventada; a releitura só substitui o que a
   * Interface devolver. A consulta digitada continua onde está — o "Tentar
   * novamente" só refaz a leitura.
   */
  function recarregar() {
    setTentativa((atual) => atual + 1);
  }

  /**
   * Limpa a busca e devolve o foco ao campo, para que a próxima digitação
   * caia no lugar certo sem um clique extra (FR-356).
   */
  function limparFiltros() {
    setConsulta("");
    campoDeBusca.current?.focus();
  }

  const baralhosFiltrados = filtrarBaralhos(baralhos, consulta);
  const listaCarregada = !carregando && falhaDeListagem === null;

  return (
    <div className="pagina">
      <header className="cabecalho-da-pagina">
        <div>
          <h1>Baralhos</h1>
          <p className="texto-secundario">
            Escolha o que você quer memorizar hoje.
          </p>
        </div>
        <div className="acoes">
          <a className="botao botao--primario" href="#/baralhos/novo">
            Criar baralho
          </a>
          <a
            className="botao botao--secundario"
            href="#/baralhos/temporario"
          >
            Criar baralho temporário
          </a>
        </div>
      </header>

      <section className="filtros filtros--busca-unica" aria-label="Busca e filtros">
        <div className="campo">
          <label className="rotulo" htmlFor="busca-de-baralhos">
            Buscar baralhos
          </label>
          <input
            id="busca-de-baralhos"
            type="search"
            autoComplete="off"
            placeholder="Digite o nome do baralho"
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            ref={campoDeBusca}
          />
        </div>
      </section>

      <div className="resultado-cabecalho">
        <p role="status" aria-live="polite" aria-atomic="true">
          {listaCarregada
            ? contagemDeResultados(baralhosFiltrados.length)
            : null}
        </p>
        <button
          type="button"
          className="botao botao--secundario"
          onClick={limparFiltros}
        >
          Limpar filtros
        </button>
      </div>

      {carregando ? (
        <EstadoDaCarga estado="carregando" mensagem="Carregando Baralhos…" />
      ) : falhaDeListagem !== null ? (
        <EstadoDaCarga
          estado="falha"
          mensagem={falhaDeListagem}
          aoTentarNovamente={recarregar}
        />
      ) : baralhos.length === 0 ? (
        <EstadoDaCarga
          estado="vazio"
          mensagem="Ainda não há Baralhos. Crie o primeiro para começar a estudar."
          acao={
            <a className="botao botao--primario" href="#/baralhos/novo">
              Criar baralho
            </a>
          }
        />
      ) : baralhosFiltrados.length === 0 ? (
        <div className="estado-vazio">
          <h2>Nenhum resultado encontrado</h2>
          <p>Altere a busca ou limpe os filtros para ver o acervo.</p>
          <button
            type="button"
            className="botao botao--secundario"
            onClick={limparFiltros}
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <ul className="lista lista--compacta">
          {baralhosFiltrados.map((baralho) => (
            <ItemDeBaralho key={baralho.id} baralho={baralho} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** A contagem de resultados, com o plural da língua (FR-355). */
function contagemDeResultados(quantidade: number): string {
  return `${quantidade} ${quantidade === 1 ? "resultado" : "resultados"}`;
}

/**
 * Um Baralho na linha compacta da lista (FR-339–FR-343).
 *
 * O nome e a contagem são texto (FR-341). Estudar preserva o fluxo anterior —
 * link quando há Cartões, botão desabilitado descrito pelo motivo em texto,
 * nunca apenas pela cor, quando não há (FR-343). Editar é o link do detalhe
 * (FR-342). Os nomes acessíveis das ações incorporam o nome do Baralho, para
 * que itens homônimos continuem distinguíveis pela posição (FR-346).
 */
function ItemDeBaralho({ baralho }: { baralho: BaralhoListado }) {
  const motivoSemCartoesId = `motivo-sem-cartoes-${baralho.id}`;
  const temCartoes = baralho.quantidadeDeCartoes > 0;

  return (
    <li className="linha-da-lista">
      <div className="linha-da-lista__texto">
        <p className="linha-da-lista__titulo">{baralho.nome}</p>
        <p className="linha-da-lista__detalhe">
          {contagemDeCartoes(baralho.quantidadeDeCartoes)}
        </p>
      </div>
      <div className="linha-da-lista__acoes">
        {temCartoes ? (
          <a
            className="botao botao--secundario"
            href={hashDaRota({ nome: "estudo", id: baralho.id })}
            aria-label={`Estudar ${baralho.nome}`}
          >
            Estudar
          </a>
        ) : (
          <button
            type="button"
            className="botao botao--secundario"
            disabled
            aria-describedby={motivoSemCartoesId}
            aria-label={`Estudar ${baralho.nome}`}
          >
            Estudar
          </button>
        )}
        <a
          className="botao botao--secundario"
          href={hashDaRota({ nome: "baralho", id: baralho.id })}
          aria-label={`Editar ${baralho.nome}`}
        >
          Editar
        </a>
      </div>
      {temCartoes ? null : (
        <span id={motivoSemCartoesId} className="visualmente-oculto">
          Sem Cartões para estudar.
        </span>
      )}
    </li>
  );
}

/** Contagem de Cartões do Baralho, com o plural da língua (FR-340). */
function contagemDeCartoes(quantidade: number): string {
  return `${quantidade} ${quantidade === 1 ? "Cartão" : "Cartões"}`;
}
