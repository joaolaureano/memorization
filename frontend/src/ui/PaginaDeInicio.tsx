import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ClienteDoAcervo,
  InicioDeCompromisso,
} from "../acervo-cliente/cliente";
import { AgendaDeEstudo } from "./AgendaDeEstudo";

/**
 * A tela de Início da feature 020: o dia de hoje, e só ele (FR-330).
 *
 * O Início deixou de ser o painel do estudo inteiro. Ele é, agora, o
 * cumprimento e a Agenda de hoje — o que
 * se faz hoje. O resumo dos últimos sete dias, o gráfico da semana, o
 * calendário e as últimas Sessões foram para a área Estudo (`#/estudo`), onde
 * cabem, e com eles saiu a leitura das Estatísticas: Início não lê Registros
 * nem Estatísticas (FR-330).
 *
 * A única leitura do cabeçalho é `listarCartoes`, e ela não alimenta número
 * nenhum: serve para saber se o acervo está vazio. Vazio — e só vazio —, o
 * cabeçalho convida a criar o primeiro Cartão. A falha dessa leitura não é um
 * acervo vazio: não convida e não anuncia nada, porque quem não conseguiu ler
 * o acervo não sabe se há Cartões (FR-330).
 */

export function PaginaDeInicio({
  cliente,
  nomeDeUsuario,
  aoIniciarEstudo,
}: {
  cliente: ClienteDoAcervo;
  nomeDeUsuario: string;
  /** Abre a Sessão de um Compromisso da Agenda (016, FR-231). */
  aoIniciarEstudo?: (inicio: InicioDeCompromisso) => void;
}) {
  // `true` só depois de uma leitura do acervo que deu certo e não achou Cartão
  // nenhum: nem a falha nem a leitura em curso convidam a criar o primeiro
  // Cartão (FR-330).
  const [acervoVazio, setAcervoVazio] = useState(false);

  // Cada leitura leva um número, e só a última pode mexer no estado: é o que
  // descarta a resposta de uma leitura antiga que chegue depois da mais nova.
  const leituraDoAcervo = useRef(0);

  // Depois da desmontagem não há mais estado para atualizar.
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;

    return () => {
      montado.current = false;
    };
  }, []);

  const carregarAcervo = useCallback(async () => {
    leituraDoAcervo.current += 1;
    const numeroDestaLeitura = leituraDoAcervo.current;

    let resultado: Awaited<ReturnType<ClienteDoAcervo["listarCartoes"]>>;

    try {
      resultado = await cliente.listarCartoes();
    } catch {
      // O cliente pode lançar em vez de devolver uma falha; para quem lê, o
      // efeito é o mesmo — e nunca um convite enganoso.
      if (numeroDestaLeitura !== leituraDoAcervo.current || !montado.current) {
        return;
      }

      setAcervoVazio(false);

      return;
    }

    if (numeroDestaLeitura !== leituraDoAcervo.current || !montado.current) {
      return;
    }

    // A falha não é um acervo vazio: sem leitura de sucesso, o cabeçalho não
    // convida a nada (FR-330).
    setAcervoVazio(resultado.ok && resultado.cartoes.length === 0);
  }, [cliente]);

  // A leitura começa junto com a montagem.
  useEffect(() => {
    void carregarAcervo();
  }, [carregarAcervo]);

  return (
    <div className="pagina">
      {/* O cabeçalho é o cumprimento e, quando o acervo está vazio, o convite
          a criar o primeiro Cartão — nada além disso (FR-330). */}
      <div className="inicio__cabecalho">
        <h1>Olá, {nomeDeUsuario}</h1>

        {acervoVazio ? (
          <p>
            <a className="botao botao--primario" href="#/baralhos">
              Ver Baralhos
            </a>
          </p>
        ) : null}
      </div>

      <div className="inicio__blocos">
        <AgendaDeEstudo
          cliente={cliente}
          modo="hoje"
          aoIniciarEstudo={aoIniciarEstudo}
        />
      </div>
    </div>
  );
}
