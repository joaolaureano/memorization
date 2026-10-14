import { TextoDoProduto } from "../idioma";
import { MENSAGENS_PT } from "../idioma/mensagens";
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
import { useIdioma, type Catalogo } from "../idioma";
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
export const MENSAGEM_DE_CONFIRMACAO_DIVERGENTE = MENSAGENS_PT.confirmacaoDivergente;

/**
 * O motivo da saída bloqueada enquanto o Cadastro é enviado (FR-154). Não é
 * código do contrato: é a razão anunciada pela proteção de saída.
 */
export const MENSAGEM_DE_SAIDA_BLOQUEADA = MENSAGENS_PT.saidaBloqueadaDoCadastro;

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
  const { textos } = useIdioma();
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

  const avisoDoNome = avisoDoNomeDeUsuario(nomeDeUsuario, textos);
  const avisoDaSenha = avisoDaSenhaDigitada(senha, textos);

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
          titulo: textos.acesso.descartarCadastro,
          descricao: textos.acesso.dadosPreenchidosPerdidos,
          rotuloDeConfirmacao: textos.acesso.descartar,
        }
      : null;

  useProtecaoDeSaida(protecao);

  return (
    <section className="acesso">
      <h1>{textos.acesso.criar_conta_rotulo}</h1>

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
          aria-label={textos.acesso.aria_cadastro_concluido}
        >
          {textos.acesso.cadastro_concluido(usuarioCadastrado.nomeDeUsuario)}
        </p>
      )}

      <form className="formulario cartao" onSubmit={cadastrar}>
        <div className="campo">
          <label className="rotulo" htmlFor="campo-nome-de-usuario">
            {textos.acesso.nomeDeUsuario}
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
            {textos.acesso.regras_nome(
              LIMITE_MINIMO_DE_NOME_DE_USUARIO,
              LIMITE_MAXIMO_DE_NOME_DE_USUARIO
            )}
          </p>
          <p id="contador-do-nome-de-usuario" className="contador">
            {textos.acesso.contador(
              nomeDeUsuario.length,
              LIMITE_MAXIMO_DE_NOME_DE_USUARIO
            )}
          </p>
          {avisoDoNome !== null && (
            <p id="aviso-do-nome-de-usuario" className="ajuda">
              <TextoDoProduto texto={avisoDoNome} />
            </p>
          )}
        </div>

        <CampoDeSenha
          id="campo-senha"
          rotulo={textos.acesso.senha}
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
            {textos.acesso.regras_senha(
              LIMITE_MINIMO_DE_SENHA,
              LIMITE_MAXIMO_DE_SENHA
            )}
          </p>
          <p id="contador-da-senha" className="contador">
            {textos.acesso.contador(senha.length, LIMITE_MAXIMO_DE_SENHA)}
          </p>
          {avisoDaSenha !== null && (
            <p id="aviso-da-senha" className="ajuda">
              <TextoDoProduto texto={avisoDaSenha} />
            </p>
          )}
        </CampoDeSenha>

        <CampoDeSenha
          id="campo-confirmacao-da-senha"
          rotulo={textos.acesso.confirmacaoDaSenha}
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
            aria-label={textos.acesso.aria_falha_no_cadastro}
          >
            <TextoDoProduto texto={falha} />
          </p>
        )}

        <button
          className="botao botao--primario"
          type="submit"
          disabled={submetendo}
        >
          {submetendo ? textos.acesso.criandoConta : textos.acesso.botaoCriarConta}
        </button>
      </form>

      {usuarioCadastrado === null ? (
        // FR-097: a volta a "Entrar", o caminho de quem já tem Usuário.
        <p className="voltar">
          {textos.acesso.ja_tem_uma_conta} <a href="#/entrar">{textos.acesso.link_entrar}</a>
        </p>
      ) : (
        // FR-143: concluído o Cadastro, o próximo passo é Entrar — sem entrada
        // automática, e sem deixar duas ações com o nome "Entrar".
        <p className="voltar">
          <a href="#/entrar">{textos.acesso.link_entrar}</a>
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
function avisoDoNomeDeUsuario(nomeDeUsuario: string, textos: Catalogo): string | null {
  const comprimento = nomeDeUsuario.length;

  if (comprimento > 0 && comprimento < LIMITE_MINIMO_DE_NOME_DE_USUARIO) {
    return textos.acesso.aviso_nome_minimo(LIMITE_MINIMO_DE_NOME_DE_USUARIO, comprimento);
  }

  const restantes = LIMITE_MAXIMO_DE_NOME_DE_USUARIO - comprimento;

  if (restantes > FOLGA_PARA_AVISO_DE_LIMITE) {
    return null;
  }

  if (restantes < 0) {
    return textos.acesso.aviso_nome_maximo(LIMITE_MAXIMO_DE_NOME_DE_USUARIO);
  }

  if (restantes === 0) {
    return textos.acesso.aviso_nome_limite_atingido(LIMITE_MAXIMO_DE_NOME_DE_USUARIO);
  }

  return textos.acesso.aviso_nome_restante(restantes, LIMITE_MAXIMO_DE_NOME_DE_USUARIO);
}

/**
 * Comunicação dos limites da Senha durante a digitação (FR-080): o mínimo de
 * 8 caracteres é comunicado enquanto a Senha é curta, e o máximo de 128
 * conforme ele se aproxima — os dois limites que a Senha tem (FR-075). Nenhuma
 * regra de composição é comunicada, porque nenhuma existe (FR-085).
 */
function avisoDaSenhaDigitada(senha: string, textos: Catalogo): string | null {
  const comprimento = senha.length;

  if (comprimento > 0 && comprimento < LIMITE_MINIMO_DE_SENHA) {
    return textos.acesso.aviso_senha_minimo(LIMITE_MINIMO_DE_SENHA, comprimento);
  }

  const restantes = LIMITE_MAXIMO_DE_SENHA - comprimento;

  if (restantes > FOLGA_PARA_AVISO_DE_LIMITE) {
    return null;
  }

  if (restantes < 0) {
    return textos.acesso.aviso_senha_maximo(LIMITE_MAXIMO_DE_SENHA);
  }

  if (restantes === 0) {
    return textos.acesso.aviso_senha_limite_atingido(LIMITE_MAXIMO_DE_SENHA);
  }

  return textos.acesso.aviso_senha_restante(restantes, LIMITE_MAXIMO_DE_SENHA);
}
