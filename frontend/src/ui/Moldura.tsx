import { destinoAtivo, hashDaRota } from "./navegacao";
import type { Rota } from "./navegacao";

/**
 * A moldura da aplicação (FR-139): a marca, a navegação principal e Sair.
 *
 * Os destinos são Início, Baralhos, Cartões e Preferências, nessa ordem
 * (FR-168, FR-212): o Início abre a navegação por ser a rota padrão, o destino
 * de quem acabou de Entrar, e Preferências fecha a lista por ser a tela de
 * ajustes do Usuário.
 *
 * A marca e Sair ficam no cabeçalho em qualquer largura; é a navegação que, em
 * telas de até 600px, desce para a barra inferior pela CSS (`.moldura`,
 * `.navegacao-principal`). Por isso Sair é irmão do `<nav>`, e não parte dele.
 *
 * O destino corrente vem de `destinoAtivo(rota)`, a mesma decisão que as telas
 * do acervo usam — comparar strings de rota aqui duplicaria o mapa de rotas.
 * Como Entrar e Criar conta não pertencem à moldura do acervo, nenhum destino
 * fica marcado quando `destinoAtivo` devolve `null`.
 *
 * Os `href` saem de `hashDaRota`, para que a forma dos caminhos viva só em
 * `./navegacao`, e o link da marca leva à rota padrão, Início.
 */
export function Moldura({
  rota,
  aoSair,
}: {
  rota: Rota;
  aoSair: () => void;
}) {
  const destino = destinoAtivo(rota);

  return (
    <header className="moldura">
      <a className="marca" href={hashDaRota({ nome: "inicio" })}>
        memorization
      </a>

      <nav aria-label="Principal" className="navegacao-principal">
        <a
          href={hashDaRota({ nome: "inicio" })}
          aria-current={destino === "inicio" ? "page" : undefined}
        >
          Início
        </a>
        <a
          href={hashDaRota({ nome: "baralhos" })}
          aria-current={destino === "baralhos" ? "page" : undefined}
        >
          Baralhos
        </a>
        <a
          href={hashDaRota({ nome: "cartoes" })}
          aria-current={destino === "cartoes" ? "page" : undefined}
        >
          Cartões
        </a>
        <a
          href={hashDaRota({ nome: "preferencias" })}
          aria-current={destino === "preferencias" ? "page" : undefined}
        >
          Preferências
        </a>
      </nav>

      <button type="button" className="botao-de-saida" onClick={aoSair}>
        Sair
      </button>
    </header>
  );
}
