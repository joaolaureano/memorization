import { useRef, useState } from "react";
import type { FormEvent } from "react";

import type { ClienteDoAcervo, Usuario } from "../acervo-cliente/cliente";
import {
  LIMITE_MAXIMO_DE_NOME_DE_USUARIO,
  LIMITE_MAXIMO_DE_SENHA,
  LIMITE_MINIMO_DE_NOME_DE_USUARIO,
  LIMITE_MINIMO_DE_SENHA,
  ehCodigoDeErroDeCadastro,
  type CodigoDeErroDeCadastro,
} from "../acervo-cliente/validacao";
import { CampoDeSenha } from "./CampoDeSenha";
import { useProtecaoDeSaida, type Protecao } from "./protecao-de-saida";

/**
 * Tela "Criar conta" (T608 a T612; specs/007-criar-usuario/tasks.md).
 *
 * Consome somente a Interface `ClienteDoAcervo` — o Adapter (Http em produção,
 * EmMemoria em teste) chega por propriedade — e **não reproduz nenhuma regra de
 * domínio**: o conteúdo é submetido ao cliente, e a recusa é exibida com a
 * mensagem em português exatamente como o cliente a devolveu (FR-046). As
 * únicas constantes de domínio usadas aqui são os limites e o alfabeto,
 * importados de `validacao.ts`, e apenas para comunicar contagem e limite
 * **durante a digitação** (FR-080) — nunca para recusar conteúdo.
 *
 * FR-072 e FR-081: a Confirmação da Senha existe apenas nesta tela, e é aqui
 * que ela é comparada. Divergente, **nada é enviado** ao cliente e o foco vai
 * para a Confirmação; nas demais recusas, o foco vai ao campo que precisa de
 * correção, guiado apenas pelo código estável devolvido pela Interface.
 *
 * FR-044 e FR-045: a falha de gravação é reportada, o Cadastro **não** aparece
 * como concluído e os três campos mantêm o conteúdo digitado para nova
 * tentativa. FR-083: a conclusão é confirmada de forma explícita, por região
 * ativa (FR-082). Depois do sucesso, os dois campos de Senha são apagados do
 * estado do componente — a Senha não permanece na página (FR-078).
 *
 * FR-097: o Cadastro é a única tela além de "Entrar" alcançável sem Credencial,
 * e oferece a volta a "Entrar"; concluído o Cadastro, oferece Entrar em seguida
 * — o próximo passo de quem acabou de criar o Usuário. As duas ofertas são
 * exclusivas, de modo que exista uma única ação com o nome "Entrar" em cada
 * momento da tela.
 *
 * FR-141 a FR-143: a tela segue o vocabulário visual do protótipo (`acesso`,
 * `cartao`, `botao--primario`) e os dois campos de Senha usam o
 * `CampoDeSenha`, cada um com o seu próprio Mostrar/Ocultar (FR-142). Concluído
 * o Cadastro, a confirmação aparece com acesso a Entrar — nunca uma entrada
 * automática.
 *
 * FR-148 e FR-154: com conteúdo digitado e ainda não concluído, sair da tela
 * passa pela proteção de saída (`descarte`); com o envio em andamento, a saída
 * é bloqueada e o motivo é anunciado (`pendencia`).
 */

/**
 * Folga a partir da qual a aproximação do limite passa a ser comunicada
 * explicitamente. Decisão de apresentação da tela, não regra de domínio: a
 * recusa de conteúdo fora do intervalo permanece exclusiva do
 * `ClienteDoAcervo`.
 */
const FOLGA_PARA_AVISO_DE_LIMITE = 10;

/**
 * A recusa de Confirmação divergente (FR-072). Não é código do contrato: a
 * Confirmação existe só na tela, e a API nunca recebe esse campo
 * (`contracts/api-usuarios.md`).
 */
export const MENSAGEM_DE_CONFIRMACAO_DIVERGENTE =
  "A Senha e a Confirmação da Senha estão diferentes. Digite a mesma Senha nos dois campos.";

/**
 * O motivo da saída bloqueada enquanto o Cadastro é enviado (FR-154). Não é
 * código do contrato: é a razão anunciada pela proteção de saída.
 */
export const MENSAGEM_DE_SAIDA_BLOQUEADA =
  "Aguarde: o Cadastro está sendo enviado.";

/**
 * Campo a corrigir para cada recusa de regra de Cadastro (FR-081).
 *
 * A tela não reproduz nenhuma regra de domínio: qual campo precisa de correção
 * é decidido exclusivamente pelo código estável devolvido pela Interface
 * `ClienteDoAcervo`, e este mapa apenas o traduz em direção de foco.
 * `indisponivel` fica de fora de propósito — quando o transporte falha, nenhum
 * campo precisa de correção e o foco permanece onde estava.
 */
const CAMPO_PARA_CORRECAO: Readonly<
  Record<CodigoDeErroDeCadastro, "nomeDeUsuario" | "senha">
> = {
  nome_de_usuario_invalido: "nomeDeUsuario",
  senha_invalida: "senha",
  nome_de_usuario_existente: "nomeDeUsuario",
};

interface PropriedadesDaPaginaDeCadastro {
  cliente: ClienteDoAcervo;
}

export function PaginaDeCadastro({
  cliente,
}: PropriedadesDaPaginaDeCadastro) {
  const [nomeDeUsuario, setNomeDeUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacaoDaSenha, setConfirmacaoDaSenha] = useState("");
  const [submetendo, setSubmetendo] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [usuarioCadastrado, setUsuarioCadastrado] = useState<Usuario | null>(
    null,
  );
  const [sequenciaDeConfirmacao, setSequenciaDeConfirmacao] = useState(0);

  const campoDeNomeDeUsuario = useRef<HTMLInputElement>(null);
  const campoDeSenha = useRef<HTMLInputElement>(null);
  const campoDeConfirmacaoDaSenha = useRef<HTMLInputElement>(null);

  async function cadastrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setFalha(null);
    setUsuarioCadastrado(null);

    // FR-072: a Confirmação divergente é recusada **antes** de qualquer envio,
    // e o foco vai para a Confirmação (FR-081).
    if (senha !== confirmacaoDaSenha) {
      setFalha(MENSAGEM_DE_CONFIRMACAO_DIVERGENTE);
      campoDeConfirmacaoDaSenha.current?.focus();
      return;
    }

    setSubmetendo(true);

    const resultado = await cliente.criarUsuario({ nomeDeUsuario, senha });

    if (resultado.ok) {
      setUsuarioCadastrado(resultado.usuario);
      setSequenciaDeConfirmacao((atual) => atual + 1);

      // FR-078: a Senha não permanece no estado depois do sucesso. O Nome de
      // usuário fica, porque a confirmação nomeia o Usuário criado.
      setSenha("");
      setConfirmacaoDaSenha("");
    } else {
      setFalha(resultado.mensagem);

      if (ehCodigoDeErroDeCadastro(resultado.erro)) {
        const campo = CAMPO_PARA_CORRECAO[resultado.erro];
        const alvo = campo === "senha" ? campoDeSenha : campoDeNomeDeUsuario;

        alvo.current?.focus();
      }
    }

    setSubmetendo(false);
  }

  const avisoDoNome = avisoDoNomeDeUsuario(nomeDeUsuario);
  const avisoDaSenha = avisoDaSenhaDigitada(senha);

  // FR-148: enquanto houver conteúdo digitado e não concluído, sair da tela
  // passa pela confirmação; FR-154: com o envio em andamento, a saída é apenas
  // bloqueada e o motivo, anunciado.
  const formularioPreenchido =
    nomeDeUsuario !== "" || senha !== "" || confirmacaoDaSenha !== "";

  const protecao: Protecao | null = submetendo
    ? { tipo: "pendencia", motivo: MENSAGEM_DE_SAIDA_BLOQUEADA }
    : usuarioCadastrado === null && formularioPreenchido
      ? {
          tipo: "descarte",
          titulo: "Descartar o Cadastro?",
          descricao: "Os dados preenchidos serão perdidos.",
          rotuloDeConfirmacao: "Descartar",
        }
      : null;

  useProtecaoDeSaida(protecao);

  return (
    <section className="acesso">
      <h1>Criar conta</h1>

      {usuarioCadastrado !== null && (
        // FR-082 e FR-083: a conclusão do Cadastro é anunciada por região
        // ativa polida, e não apenas exibida. O papel já implica
        // `aria-live="polite"` e `aria-atomic="true"`; os atributos vêm
        // explícitos com os mesmos valores para que a semântica seja
        // asseverável por teste, sem mudar o que o leitor de tela anuncia.
        <p
          key={sequenciaDeConfirmacao}
          className="aviso aviso--sucesso"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Cadastro concluído"
        >
          Cadastro concluído. O Usuário {usuarioCadastrado.nomeDeUsuario} foi
          criado.
        </p>
      )}

      <form className="formulario cartao" onSubmit={cadastrar}>
        <div className="campo">
          <label className="rotulo" htmlFor="campo-nome-de-usuario">
            Nome de usuário
          </label>
          <input
            id="campo-nome-de-usuario"
            ref={campoDeNomeDeUsuario}
            value={nomeDeUsuario}
            onChange={(evento) => setNomeDeUsuario(evento.target.value)}
            aria-describedby={
              avisoDoNome === null
                ? "regras-do-nome-de-usuario contador-do-nome-de-usuario"
                : "regras-do-nome-de-usuario contador-do-nome-de-usuario aviso-do-nome-de-usuario"
            }
          />
          <p id="regras-do-nome-de-usuario" className="ajuda">
            De {LIMITE_MINIMO_DE_NOME_DE_USUARIO} a{" "}
            {LIMITE_MAXIMO_DE_NOME_DE_USUARIO} caracteres: letras de A a Z sem
            acento, dígitos, ponto, sublinhado e hífen.
          </p>
          <p id="contador-do-nome-de-usuario" className="contador">
            {nomeDeUsuario.length} / {LIMITE_MAXIMO_DE_NOME_DE_USUARIO}{" "}
            caracteres
          </p>
          {avisoDoNome !== null && (
            <p id="aviso-do-nome-de-usuario" className="ajuda">
              {avisoDoNome}
            </p>
          )}
        </div>

        <CampoDeSenha
          id="campo-senha"
          rotulo="Senha"
          valor={senha}
          aoMudar={setSenha}
          autoComplete="new-password"
          descritoPor={
            avisoDaSenha === null
              ? "regras-da-senha contador-da-senha"
              : "regras-da-senha contador-da-senha aviso-da-senha"
          }
          referencia={campoDeSenha}
        >
          <p id="regras-da-senha" className="ajuda">
            De {LIMITE_MINIMO_DE_SENHA} a {LIMITE_MAXIMO_DE_SENHA} caracteres:
            qualquer caractere, inclusive espaços.
          </p>
          <p id="contador-da-senha" className="contador">
            {senha.length} / {LIMITE_MAXIMO_DE_SENHA} caracteres
          </p>
          {avisoDaSenha !== null && (
            <p id="aviso-da-senha" className="ajuda">
              {avisoDaSenha}
            </p>
          )}
        </CampoDeSenha>

        <CampoDeSenha
          id="campo-confirmacao-da-senha"
          rotulo="Confirmação da Senha"
          valor={confirmacaoDaSenha}
          aoMudar={setConfirmacaoDaSenha}
          autoComplete="new-password"
          referencia={campoDeConfirmacaoDaSenha}
        />

        {falha !== null && (
          // FR-082: a recusa é anunciada por região assertiva, e não apenas
          // exibida. O papel `alert` já implica região assertiva e atômica;
          // nenhum `aria-live` explícito redundante, que poderia duplicar o
          // anúncio.
          <p
            className="aviso aviso--erro"
            role="alert"
            aria-label="Falha no Cadastro"
          >
            {falha}
          </p>
        )}

        <button
          className="botao botao--primario"
          type="submit"
          disabled={submetendo}
        >
          {submetendo ? "Criando conta…" : "Criar conta"}
        </button>
      </form>

      {usuarioCadastrado === null ? (
        // FR-097: a volta a "Entrar", o caminho de quem já tem Usuário.
        <p className="voltar">
          Já tem uma conta? <a href="#/entrar">Entrar</a>
        </p>
      ) : (
        // FR-143: concluído o Cadastro, o próximo passo é Entrar — sem entrada
        // automática, e sem deixar duas ações com o nome "Entrar".
        <p className="voltar">
          <a href="#/entrar">Entrar</a>
        </p>
      )}
    </section>
  );
}

/**
 * Comunicação dos limites do Nome de usuário durante a digitação (FR-080).
 *
 * Devolve `null` longe dos limites e, perto deles ou fora deles, um aviso
 * explícito sobre o que foi digitado — sem recusar nada: a recusa é sempre do
 * `ClienteDoAcervo`, e esta função não a antecipa nem a reproduz.
 */
function avisoDoNomeDeUsuario(nomeDeUsuario: string): string | null {
  const comprimento = nomeDeUsuario.length;

  if (comprimento > 0 && comprimento < LIMITE_MINIMO_DE_NOME_DE_USUARIO) {
    return (
      `Atenção: o nome de usuário deve ter pelo menos ` +
      `${LIMITE_MINIMO_DE_NOME_DE_USUARIO} caracteres; o informado tem ` +
      `${comprimento}.`
    );
  }

  const restantes = LIMITE_MAXIMO_DE_NOME_DE_USUARIO - comprimento;

  if (restantes > FOLGA_PARA_AVISO_DE_LIMITE) {
    return null;
  }

  if (restantes < 0) {
    return `Atenção: o nome de usuário excede o limite de ${LIMITE_MAXIMO_DE_NOME_DE_USUARIO} caracteres.`;
  }

  if (restantes === 0) {
    return `Atenção: o nome de usuário atingiu o limite de ${LIMITE_MAXIMO_DE_NOME_DE_USUARIO} caracteres.`;
  }

  return `Atenção: faltam ${restantes} caracteres para o limite de ${LIMITE_MAXIMO_DE_NOME_DE_USUARIO}.`;
}

/**
 * Comunicação dos limites da Senha durante a digitação (FR-080): o mínimo de
 * 8 caracteres é comunicado enquanto a Senha é curta, e o máximo de 128
 * conforme ele se aproxima — os dois limites que a Senha tem (FR-075). Nenhuma
 * regra de composição é comunicada, porque nenhuma existe (FR-085).
 */
function avisoDaSenhaDigitada(senha: string): string | null {
  const comprimento = senha.length;

  if (comprimento > 0 && comprimento < LIMITE_MINIMO_DE_SENHA) {
    return (
      `Atenção: a Senha deve ter pelo menos ${LIMITE_MINIMO_DE_SENHA} ` +
      `caracteres; a informada tem ${comprimento}.`
    );
  }

  const restantes = LIMITE_MAXIMO_DE_SENHA - comprimento;

  if (restantes > FOLGA_PARA_AVISO_DE_LIMITE) {
    return null;
  }

  if (restantes < 0) {
    return `Atenção: a Senha excede o limite de ${LIMITE_MAXIMO_DE_SENHA} caracteres.`;
  }

  if (restantes === 0) {
    return `Atenção: a Senha atingiu o limite de ${LIMITE_MAXIMO_DE_SENHA} caracteres.`;
  }

  return `Atenção: faltam ${restantes} caracteres para o limite da Senha de ${LIMITE_MAXIMO_DE_SENHA}.`;
}
