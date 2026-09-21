import { useRef, useState } from "react";
import type { FormEvent } from "react";

import type { ClienteDoAcervo, Credencial } from "../acervo-cliente/cliente";

/**
 * Tela "Entrar" (T708 a T713; specs/008-entrar/tasks.md).
 *
 * É a primeira e única tela alcançável enquanto nenhuma Credencial for mantida
 * (FR-097, SC-027), e oferece o acesso a "Criar conta" — que deixou de ser
 * oferecido pela navegação principal (FR-098).
 *
 * Consome somente a Interface `ClienteDoAcervo` — o Adapter (Http em produção,
 * EmMemoria em teste) chega por propriedade — e **não reproduz nenhuma regra de
 * domínio**: a Credencial é submetida ao cliente e a recusa é exibida com a
 * mensagem em português exatamente como o cliente a devolveu (FR-046). A tela
 * não sabe se o Nome de usuário existe nem se a Senha está certa, porque a
 * recusa é uma só (FR-088).
 *
 * A Credencial vive apenas no estado desta página e é entregue a quem entrou
 * (`aoEntrar`), que a mantém na memória da aplicação (FR-089). Ela nunca vai
 * para armazenamento, cookie ou URL (FR-078, SC-033), e a Senha sai do estado
 * da tela assim que deixa de ser necessária (FR-078).
 *
 * FR-095: o percurso do primeiro campo ao Entrar é completo só por teclado, com
 * o foco visível por contorno — não apenas por cor. Numa recusa, a Senha é
 * apagada, o Nome de usuário permanece digitado e o foco vai ao campo que
 * precisa de correção. FR-096: a recusa e a conclusão de Sair são anunciadas
 * por região ativa, e não apenas exibidas.
 */

/**
 * O aviso com que a tela "Entrar" já chega: a recusa que descartou a Credencial
 * de uma operação (FR-091) ou a conclusão de Sair (FR-096).
 */
export interface AvisoDaEntrada {
  tipo: "falha" | "saida";
  texto: string;
}

/**
 * A conclusão de Sair, anunciada na tela "Entrar" (FR-096). O texto nomeia a
 * ação e o seu efeito, sem sinônimos de `_Avoid_` de `CONTEXT.md`.
 */
export const MENSAGEM_DE_SAIDA =
  "Você saiu. A Credencial foi descartada; informe o Nome de usuário e a Senha para Entrar novamente.";

interface PropriedadesDaPaginaDeEntrada {
  cliente: ClienteDoAcervo;
  aoEntrar: (credencial: Credencial) => void;
  aviso?: AvisoDaEntrada | null;
}

export function PaginaDeEntrada({
  cliente,
  aoEntrar,
  aviso = null,
}: PropriedadesDaPaginaDeEntrada) {
  const [nomeDeUsuario, setNomeDeUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [submetendo, setSubmetendo] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  const campoDeNomeDeUsuario = useRef<HTMLInputElement>(null);
  const campoDaSenha = useRef<HTMLInputElement>(null);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setFalha(null);
    setSubmetendo(true);

    // A Credencial é montada aqui, apresentada ao cliente e — no sucesso —
    // entregue a quem passará a mantê-la (FR-089).
    const credencial: Credencial = { nomeDeUsuario, senha };
    const resultado = await cliente.entrar(credencial);

    setSubmetendo(false);

    if (resultado.ok) {
      // A Senha sai do estado da tela assim que deixa de ser necessária
      // (FR-078).
      setSenha("");
      aoEntrar(credencial);
      return;
    }

    setFalha(resultado.mensagem);

    if (resultado.erro === "indisponivel") {
      // FR-044 e FR-045: a falha de transporte é relatada, nada é apresentado
      // como concluído e **o conteúdo informado permanece** — a nova tentativa
      // não exige redigitação, e nenhum campo precisa de correção.
      return;
    }

    // FR-095: a recusa apaga a Senha e preserva o Nome de usuário. O campo que
    // precisa de correção é a Senha — a única cujo conteúdo a tentativa
    // recusada descartou —, e é para lá que o foco vai, sem que a tela revele
    // qual parte da Credencial falhou (FR-088).
    setSenha("");
    campoDaSenha.current?.focus();
  }

  return (
    <div className="pagina">
      <h1>Entrar</h1>

      {aviso !== null &&
        (aviso.tipo === "saida" ? (
          // FR-096: a conclusão de Sair é anunciada por região ativa polida. O
          // papel já implica o anúncio; os atributos vêm explícitos para que a
          // semântica seja asseverável por teste.
          <p
            className="confirmacao-do-sair"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label="Saída concluída"
          >
            {aviso.texto}
          </p>
        ) : (
          // FR-091 e FR-096: a recusa que descartou a Credencial chega como
          // alerta nomeado, e não apenas como texto exibido.
          <p className="erro" role="alert" aria-label="Credencial recusada">
            {aviso.texto}
          </p>
        ))}

      {falha !== null && (
        // FR-096: a recusa de Entrar é anunciada por região assertiva. O papel
        // `alert` já implica região assertiva e atômica; nenhum `aria-live`
        // explícito redundante, que poderia duplicar o anúncio. A região sai da
        // árvore no início de cada tentativa, de modo que a mesma mensagem
        // repetida seja anunciada de novo.
        <p className="erro" role="alert" aria-label="Falha ao Entrar">
          {falha}
        </p>
      )}

      <form className="formulario-de-entrada" onSubmit={entrar}>
        <div className="campo">
          <label htmlFor="campo-nome-de-usuario-da-entrada">
            Nome de usuário
          </label>
          <input
            id="campo-nome-de-usuario-da-entrada"
            ref={campoDeNomeDeUsuario}
            type="text"
            autoComplete="username"
            value={nomeDeUsuario}
            onChange={(evento) => setNomeDeUsuario(evento.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="campo-senha-da-entrada">Senha</label>
          <input
            id="campo-senha-da-entrada"
            ref={campoDaSenha}
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
          />
        </div>

        <button className="botao-de-entrada" type="submit" disabled={submetendo}>
          Entrar
        </button>
      </form>

      <p className="acesso-ao-cadastro">
        Ainda não tem conta? <a href="#/criar-conta">Criar conta</a>
      </p>
    </div>
  );
}
