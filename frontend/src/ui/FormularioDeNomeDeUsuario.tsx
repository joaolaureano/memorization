import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { INDISPONIVEL } from "../acervo-cliente/cliente";
import type { ClienteDoAcervo, Credencial } from "../acervo-cliente/cliente";
import {
  LIMITE_MAXIMO_DE_NOME_DE_USUARIO,
  LIMITE_MINIMO_DE_NOME_DE_USUARIO,
} from "../acervo-cliente/validacao";
import { verificarResultadoIncerto } from "../conta/verificar-resultado";
import { CampoDeSenha } from "./CampoDeSenha";
import { useProtecaoDeSaida } from "./protecao-de-saida";
import type { Protecao } from "./protecao-de-saida";

/**
 * Formulário «Alterar Nome de usuário» (017; FR-259..FR-265).
 *
 * Pede o novo Nome de usuário e a Senha atual — a confirmação de que a pessoa
 * quer a mudança — e entrega ao cliente; **não reproduz regra alguma**: o
 * alfabeto, os limites, `mesmo_nome` e `nome_indisponivel` vêm do servidor, com
 * a mensagem em português que ele devolveu, e o foco vai ao campo que precisa
 * de correção (FR-260..FR-262). A `senha_atual_incorreta` mostra a mensagem
 * única, apaga só os campos de Senha e mantém o digitado (FR-279).
 *
 * No sucesso, `aoConcluir` recebe a nova Credencial — o nome gravado e a Senha
 * atual, que continua a mesma — para a aplicação a substituir em memória, sem
 * nova Entrada (FR-263). Quando a resposta se perde, a tela não anuncia
 * sucesso nem falha: verifica qual Credencial vale agora e só então conclui
 * (FR-280, FR-281); sem como saber, oferece «Tentar novamente» e «Ir para
 * Entrar» (FR-282). «Tentar novamente» repete a **verificação**, nunca a
 * alteração, de modo que a mudança não é aplicada duas vezes (FR-283).
 */

export const MENSAGEM_DE_RESULTADO_DESCONHECIDO_DO_NOME =
  "Não foi possível confirmar se o Nome de usuário foi alterado.";

export const MENSAGEM_DE_NOME_NAO_ALTERADO =
  "Não foi possível alterar o Nome de usuário agora. Nada foi alterado. Tente novamente.";

interface PropriedadesDoFormularioDeNomeDeUsuario {
  cliente: ClienteDoAcervo;
  nomeAtual: string;
  aoConcluir: (novaCredencial: Credencial) => void;
  aoCancelar: () => void;
  /** Descarta a Credencial e vai a Entrar, quando o resultado é desconhecido. */
  aoIrParaEntrar: () => void;
}

export function FormularioDeNomeDeUsuario({
  cliente,
  nomeAtual,
  aoConcluir,
  aoCancelar,
  aoIrParaEntrar,
}: PropriedadesDoFormularioDeNomeDeUsuario) {
  const [novoNome, setNovoNome] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [incerto, setIncerto] = useState(false);

  const campoDoNome = useRef<HTMLInputElement>(null);
  const campoDaSenha = useRef<HTMLInputElement>(null);

  const antiga: Credencial = { nomeDeUsuario: nomeAtual, senha: senhaAtual };
  const nova: Credencial = {
    nomeDeUsuario: novoNome.trim(),
    senha: senhaAtual,
  };

  function concluir(credencial: Credencial): void {
    setSenhaAtual("");
    aoConcluir(credencial);
  }

  async function conferir(): Promise<void> {
    setEnviando(true);
    setIncerto(false);
    setFalha(null);

    const decisao = await verificarResultadoIncerto(cliente, "alterar-nome", {
      antiga,
      nova,
    });

    setEnviando(false);

    if (decisao === "aplicada") {
      concluir(nova);
    } else if (decisao === "nao_aplicada") {
      setFalha(MENSAGEM_DE_NOME_NAO_ALTERADO);
    } else {
      setIncerto(true);
    }
  }

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setFalha(null);
    setIncerto(false);
    setEnviando(true);

    const resultado = await cliente.alterarNomeDeUsuario({
      senhaAtual,
      novoNomeDeUsuario: novoNome,
    });

    if (resultado.ok) {
      setEnviando(false);
      concluir({ nomeDeUsuario: resultado.nomeDeUsuario, senha: senhaAtual });
      return;
    }

    if (resultado.erro === INDISPONIVEL) {
      // FR-280: a resposta pode ter se perdido com a alteração aplicada; o
      // estado real é verificado antes de qualquer anúncio.
      await conferir();
      return;
    }

    setEnviando(false);
    setFalha(resultado.mensagem);

    if (resultado.erro === "senha_atual_incorreta") {
      // FR-279: só os campos de Senha são apagados; o foco vai a eles.
      setSenhaAtual("");
      campoDaSenha.current?.focus();
    } else if (resultado.erro !== "nao_autenticado") {
      campoDoNome.current?.focus();
    }
  }

  const protecao: Protecao | null = enviando
    ? {
        tipo: "pendencia",
        motivo: "Aguarde: o Nome de usuário está sendo alterado.",
      }
    : novoNome !== "" || senhaAtual !== ""
      ? {
          tipo: "descarte",
          titulo: "Descartar a alteração?",
          descricao: "O novo Nome de usuário digitado será perdido.",
          rotuloDeConfirmacao: "Descartar",
        }
      : null;

  useProtecaoDeSaida(protecao);

  return (
    <form
      className="formulario"
      aria-label="Alterar Nome de usuário"
      noValidate
      onSubmit={(evento) => void enviar(evento)}
    >
      <p className="ajuda">
        Nome de usuário atual: <strong>{nomeAtual}</strong>
      </p>

      <div className="campo">
        <label className="rotulo" htmlFor="campo-novo-nome-de-usuario">
          Novo Nome de usuário
        </label>
        <input
          id="campo-novo-nome-de-usuario"
          ref={campoDoNome}
          type="text"
          autoComplete="username"
          value={novoNome}
          onChange={(evento) => setNovoNome(evento.target.value)}
          aria-describedby="regras-do-novo-nome-de-usuario"
        />
        <p id="regras-do-novo-nome-de-usuario" className="ajuda">
          De {LIMITE_MINIMO_DE_NOME_DE_USUARIO} a{" "}
          {LIMITE_MAXIMO_DE_NOME_DE_USUARIO} caracteres: letras de A a Z sem
          acento, dígitos, ponto, sublinhado e hífen.
        </p>
      </div>

      <CampoDeSenha
        id="campo-senha-atual-do-nome"
        rotulo="Senha atual"
        valor={senhaAtual}
        aoMudar={setSenhaAtual}
        autoComplete="current-password"
        referencia={campoDaSenha}
      />

      {falha !== null && (
        <p
          className="aviso aviso--erro"
          role="alert"
          aria-label="Falha ao alterar o Nome de usuário"
        >
          {falha}
        </p>
      )}

      {incerto && (
        <div
          className="aviso aviso--erro"
          role="alert"
          aria-label="Resultado desconhecido"
        >
          <p>{MENSAGEM_DE_RESULTADO_DESCONHECIDO_DO_NOME}</p>
          <div className="acoes">
            <button
              className="botao botao--primario"
              type="button"
              onClick={() => void conferir()}
            >
              Tentar novamente
            </button>
            <button
              className="botao botao--secundario"
              type="button"
              onClick={aoIrParaEntrar}
            >
              Ir para Entrar
            </button>
          </div>
        </div>
      )}

      <div className="acoes">
        <button
          className="botao botao--primario"
          type="submit"
          disabled={enviando || incerto}
        >
          {enviando ? "Alterando…" : "Alterar Nome de usuário"}
        </button>
        <button
          className="botao botao--secundario"
          type="button"
          disabled={enviando}
          onClick={aoCancelar}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
