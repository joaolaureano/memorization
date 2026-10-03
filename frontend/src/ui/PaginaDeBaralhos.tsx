import { useEffect, useState } from "react";

import type {
  BaralhoListado,
  ClienteDoAcervo,
} from "../acervo-cliente/cliente";
import { EstadoDaCarga } from "./EstadoDaCarga";
import { hashDaRota } from "./navegacao";

/**
 * Tela de Baralhos (T1108; spec 012: FR-140, FR-144, FR-148, FR-153; FR-046 e
 * FR-060 herdados de 002/005).
 *
 * É **somente a lista**: a criação mora em `PaginaDoFormularioDeBaralho` e
 * começa apenas por ação da pessoa, pelo link "Criar baralho" (FR-140). A tela
 * consome exclusivamente a Interface `ClienteDoAcervo` — o Adapter (Http em
 * produção, EmMemoria em teste) chega por propriedade — e não reproduz nenhuma
 * regra de domínio: as mensagens exibidas são as que o cliente devolve, em
 * português (FR-046).
 *
 * Carregando, falha e vazio vêm de `EstadoDaCarga` (FR-153), e a falha oferece
 * "Tentar novamente", que relê a lista pela Interface (FR-148).
 *
 * Cada Baralho é uma linha fina (FR-144 revisado, SC-079): o nome é o próprio
 * link do detalhe — sem rótulo de tipo, linha de status ou botão separado —,
 * com a contagem logo abaixo, dentro do mesmo link, e a elegibilidade se
 * comunica pelo controle Estudar: link quando o Baralho tem Cartões, botão
 * desabilitado descrito pelo motivo quando não tem (FR-144).
 *
 * O link do nome envolve o nome e a contagem para que o par fique centralizado
 * na linha sem que a contagem mude o nome acessível: ela é `aria-hidden` e
 * chega à tecnologia assistiva como descrição do link (`aria-describedby`).
 * Assim o nome acessível do link é exatamente o nome do Baralho (FR-144).
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
   * Interface devolver.
   */
  function recarregar() {
    setTentativa((atual) => atual + 1);
  }

  return (
    <div className="pagina">
      <header className="cabecalho-da-pagina">
        <div>
          <p className="sobretitulo">Seu acervo</p>
          <h1>Baralhos</h1>
          <p className="texto-secundario">
            Escolha o que você quer memorizar hoje.
          </p>
        </div>
        <a className="botao botao--primario" href="#/baralhos/novo">
          Criar baralho
        </a>
      </header>

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
      ) : (
        <ul className="lista lista--compacta">
          {baralhos.map((baralho) => (
            <ItemDeBaralho key={baralho.id} baralho={baralho} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Um Baralho na linha compacta da lista (FR-144 revisado, SC-079).
 *
 * O link do detalhe envolve as duas linhas do bloco — o nome e a contagem —
 * de modo que o par fique centralizado verticalmente na linha e o alvo de
 * toque cubra ambos, sem rótulo extra nem `aria-label`. A contagem, porém, é
 * decoração para a tecnologia assistiva (`aria-hidden`): por isso o nome
 * acessível do link continua sendo exatamente o nome do Baralho, e a contagem
 * chega como descrição do link, pelo `aria-describedby`. O controle Estudar
 * mantém um nome acessível único e, quando não há Cartões, é um botão
 * desabilitado descrito pelo motivo em texto — nunca apenas pela cor.
 */
function ItemDeBaralho({ baralho }: { baralho: BaralhoListado }) {
  const motivoSemCartoesId = `motivo-sem-cartoes-${baralho.id}`;
  const contagemId = `contagem-de-cartoes-${baralho.id}`;
  const temCartoes = baralho.quantidadeDeCartoes > 0;

  return (
    <li className="linha-de-baralho">
      <div className="linha-de-baralho__texto">
        <a
          className="linha-de-baralho__nome"
          href={hashDaRota({ nome: "baralho", id: baralho.id })}
          aria-describedby={contagemId}
        >
          <span className="linha-de-baralho__nome-texto">{baralho.nome}</span>
          <span
            id={contagemId}
            className="linha-de-baralho__contagem"
            aria-hidden="true"
          >
            {contagemDeCartoes(baralho.quantidadeDeCartoes)}
          </span>
        </a>
      </div>
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
      {temCartoes ? null : (
        <span id={motivoSemCartoesId} className="visualmente-oculto">
          Sem Cartões para estudar.
        </span>
      )}
    </li>
  );
}

/** Contagem de Cartões do Baralho, com o plural da língua (FR-144). */
function contagemDeCartoes(quantidade: number): string {
  return `${quantidade} ${quantidade === 1 ? "Cartão" : "Cartões"}`;
}

