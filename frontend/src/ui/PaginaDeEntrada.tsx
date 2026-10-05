import { useRef, useState } from "react";
import type { FormEvent } from "react";

import type {
  ClienteDoAcervo,
  Credencial,
  Usuario,
} from "../acervo-cliente/cliente";
import { CampoDeSenha } from "./CampoDeSenha";

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
 *
 * A apresentação segue o vocabulário de classes de `estilos.css` (FR-138), e a
 * Senha usa o `CampoDeSenha`, que traz o botão Mostrar/Ocultar sem alterar o
 * valor digitado (FR-141, FR-142). FR-153 a FR-155: a coluna única, o foco
 * visível e a submissão pendente desabilitada preservam o percurso por teclado.
 */

/**
 * O aviso com que a tela "Entrar" já chega: a recusa que descartou a Credencial
 * de uma operação (FR-091) ou a conclusão de Sair (FR-096).
 */
export interface AvisoDaEntrada {
  tipo: "falha" | "saida" | "conta-excluida";
  texto: string;
}

/**
 * A conclusão de «Excluir conta», anunciada na tela "Entrar" (017, FR-276):
 * a Credencial foi descartada junto com a conta.
 */
export const MENSAGEM_DE_CONTA_EXCLUIDA =
  "Conta excluída. Todos os dados do Usuário foram removidos.";

/**
 * A conclusão de Sair, anunciada na tela "Entrar" como status acessível
 * (FR-096; 020, FR-327): o texto exato é «Você saiu com sucesso.».
 */
export const MENSAGEM_DE_SAIDA = "Você saiu com sucesso.";

/**
 * O que a tela entrega a quem passará a manter o acesso (018): quem entrou e se
 * a pessoa escolheu **continuar conectado neste navegador** — com o Acesso
 * temporário no cookie — ou operar só com a Credencial na memória da página.
 */
export interface EscolhaDeEntrada {
  continuarConectado: boolean;
  usuario: Usuario;
}

interface PropriedadesDaPaginaDeEntrada {
  cliente: ClienteDoAcervo;
  aoEntrar: (credencial: Credencial, escolha: EscolhaDeEntrada) => void;
  aviso?: AvisoDaEntrada | null;
}

export function PaginaDeEntrada({
  cliente,
  aoEntrar,
  aviso = null,
}: PropriedadesDaPaginaDeEntrada) {
  const [nomeDeUsuario, setNomeDeUsuario] = useState("");
  const [senha, setSenha] = useState("");
  // FR-292: a continuidade vem marcada por padrão; desmarcá-la é escolha da
  // pessoa, e nenhum Acesso é emitido.
  const [continuarConectado, setContinuarConectado] = useState(true);
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
    const resultado = await cliente.entrar({
      ...credencial,
      continuarConectado,
    });

    setSubmetendo(false);

    if (resultado.ok) {
      // A Senha sai do estado da tela assim que deixa de ser necessária
      // (FR-078).
      setSenha("");
      aoEntrar(credencial, { continuarConectado, usuario: resultado.usuario });
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
    <section className="acesso">
      <div className="cartao">
        <h1>Entrar</h1>

        {aviso !== null &&
          (aviso.tipo !== "falha" ? (
            // FR-096: a conclusão de Sair é anunciada por região ativa polida. O
            // papel já implica o anúncio; os atributos vêm explícitos para que a
            // semântica seja asseverável por teste. A de «Excluir conta» segue
            // o mesmo caminho (017, FR-276).
            <p
              className="aviso aviso--sucesso"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label={
                aviso.tipo === "saida" ? "Saída concluída" : "Conta excluída"
              }
            >
              {aviso.texto}
            </p>
          ) : (
            // FR-091 e FR-096: a recusa que descartou a Credencial chega como
            // alerta nomeado, e não apenas como texto exibido.
            <p
              className="aviso aviso--erro"
              role="alert"
              aria-label="Credencial recusada"
            >
              {aviso.texto}
            </p>
          ))}

        {falha !== null && (
          // FR-096: a recusa de Entrar é anunciada por região assertiva. O papel
          // `alert` já implica região assertiva e atômica; nenhum `aria-live`
          // explícito redundante, que poderia duplicar o anúncio. A região sai da
          // árvore no início de cada tentativa, de modo que a mesma mensagem
          // repetida seja anunciada de novo.
          <p
            className="aviso aviso--erro"
            role="alert"
            aria-label="Falha ao Entrar"
          >
            {falha}
          </p>
        )}

        <form className="formulario" onSubmit={entrar}>
          <div className="campo">
            <label
              className="rotulo"
              htmlFor="campo-nome-de-usuario-da-entrada"
            >
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

          <CampoDeSenha
            id="campo-senha-da-entrada"
            rotulo="Senha"
            valor={senha}
            aoMudar={(valor) => setSenha(valor)}
            autoComplete="current-password"
            referencia={campoDaSenha}
          />

          {/* FR-292, FR-302, FR-303: a opção é uma caixa de seleção nativa —
              alcançável por Tab, alternada por Espaço, com o foco visível por
              contorno e não só por cor —, marcada por padrão e sem parágrafo de ajuda
              nem `aria-describedby` (FR-328). */}
          <div className="campo campo--opcao">
            <label className="opcao" htmlFor="campo-continuar-conectado">
              <input
                id="campo-continuar-conectado"
                type="checkbox"
                checked={continuarConectado}
                onChange={(evento) => setContinuarConectado(evento.target.checked)}
              />
              <span>Continuar conectado neste navegador</span>
            </label>
          </div>

          <button
            className="botao botao--primario"
            type="submit"
            disabled={submetendo}
          >
            {submetendo ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="ajuda">
          Ainda não tem conta? <a href="#/criar-conta">Criar conta</a>
        </p>
      </div>
    </section>
  );
}
