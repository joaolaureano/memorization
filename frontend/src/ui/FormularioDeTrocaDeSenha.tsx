import { TextoDoProduto } from "../idioma";
import { MENSAGENS_PT } from "../idioma/mensagens";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { INDISPONIVEL } from "../acervo-cliente/cliente";
import type { ClienteDoAcervo, Credencial } from "../acervo-cliente/cliente";
import {
  LIMITE_MAXIMO_DE_SENHA,
  LIMITE_MINIMO_DE_SENHA,
} from "../acervo-cliente/validacao";
import { verificarResultadoIncerto } from "../conta/verificar-resultado";
import { useIdioma } from "../idioma";
import { CampoDeSenha } from "./CampoDeSenha";
import { useProtecaoDeSaida } from "./protecao-de-saida";
import type { Protecao } from "./protecao-de-saida";

/**
 * Formulário «Trocar Senha» (017; FR-266..FR-271).
 *
 * Pede a Senha atual, a nova Senha e a Confirmação, cada uma mascarada e com o
 * seu Mostrar/Ocultar (FR-271). Nenhuma regra é reproduzida: o intervalo, a
 * `mesma_senha` e a Confirmação divergente vêm do servidor, e o foco vai ao
 * campo apontado — na divergência, à Confirmação (FR-269). `senha_atual_incorreta`
 * mostra a mensagem única e apaga só os campos de Senha (FR-279).
 *
 * No sucesso, `aoConcluir` recebe a nova Credencial (o mesmo Nome de usuário e
 * a nova Senha), e a aplicação a substitui em memória (FR-270). Resposta
 * perdida segue o mesmo caminho de verificação do Nome de usuário (FR-280..FR-283).
 */

export const MENSAGEM_DE_RESULTADO_DESCONHECIDO_DA_SENHA = MENSAGENS_PT.resultadoDesconhecidoDaSenha;

export const MENSAGEM_DE_SENHA_NAO_TROCADA = MENSAGENS_PT.senhaNaoTrocada;

interface PropriedadesDoFormularioDeTrocaDeSenha {
  cliente: ClienteDoAcervo;
  nomeDeUsuario: string;
  aoConcluir: (novaCredencial: Credencial) => void;
  aoCancelar: () => void;
  /** Descarta a Credencial e vai a Entrar, quando o resultado é desconhecido. */
  aoIrParaEntrar: () => void;
}

export function FormularioDeTrocaDeSenha({
  cliente,
  nomeDeUsuario,
  aoConcluir,
  aoCancelar,
  aoIrParaEntrar,
}: PropriedadesDoFormularioDeTrocaDeSenha) {
  const { textos } = useIdioma();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [incerto, setIncerto] = useState(false);

  const campoDaSenhaAtual = useRef<HTMLInputElement>(null);
  const campoDaNovaSenha = useRef<HTMLInputElement>(null);
  const campoDaConfirmacao = useRef<HTMLInputElement>(null);

  const antiga: Credencial = { nomeDeUsuario, senha: senhaAtual };
  const nova: Credencial = { nomeDeUsuario, senha: novaSenha };

  function concluir(credencial: Credencial): void {
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmacao("");
    aoConcluir(credencial);
  }

  async function conferir(): Promise<void> {
    setEnviando(true);
    setIncerto(false);
    setFalha(null);

    const decisao = await verificarResultadoIncerto(cliente, "trocar-senha", {
      antiga,
      nova,
    });

    setEnviando(false);

    if (decisao === "aplicada") {
      concluir(nova);
    } else if (decisao === "nao_aplicada") {
      setFalha(textos.conta.naoTrocada);
    } else {
      setIncerto(true);
    }
  }

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setFalha(null);
    setIncerto(false);
    setEnviando(true);

    const resultado = await cliente.trocarSenha({
      senhaAtual,
      novaSenha,
      confirmacaoDaSenha: confirmacao,
    });

    if (resultado.ok) {
      setEnviando(false);
      concluir({ nomeDeUsuario, senha: novaSenha });
      return;
    }

    if (resultado.erro === INDISPONIVEL) {
      await conferir();
      return;
    }

    setEnviando(false);
    setFalha(resultado.mensagem);

    if (resultado.erro === "senha_atual_incorreta") {
      // FR-279: só os campos de Senha são apagados.
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacao("");
      campoDaSenhaAtual.current?.focus();
    } else if (resultado.erro === "mesma_senha") {
      campoDaNovaSenha.current?.focus();
    } else if (resultado.erro === "dados_invalidos") {
      // FR-269: a divergência leva o foco à Confirmação.
      (resultado.campo === "confirmacaoDaSenha"
        ? campoDaConfirmacao
        : campoDaNovaSenha
      ).current?.focus();
    }
  }

  const protecao: Protecao | null = enviando
    ? { tipo: "pendencia", motivo: textos.conta.aguardeTroca }
    : senhaAtual !== "" || novaSenha !== "" || confirmacao !== ""
      ? {
          tipo: "descarte",
          titulo: textos.conta.descartarTrocaSenha,
          descricao: textos.conta.camposPreenchidosPerdidos,
          rotuloDeConfirmacao: textos.conta.descartar,
        }
      : null;

  useProtecaoDeSaida(protecao);

  return (
    <form
      className="formulario"
      aria-label={textos.conta.trocarSenhaForm}
      noValidate
      onSubmit={(evento) => void enviar(evento)}
    >
      <CampoDeSenha
        id="campo-senha-atual-da-troca"
        rotulo={textos.conta.senhaAtual}
        valor={senhaAtual}
        aoMudar={setSenhaAtual}
        autoComplete="current-password"
        referencia={campoDaSenhaAtual}
      />

      <CampoDeSenha
        id="campo-nova-senha"
        rotulo={textos.conta.novaSenha}
        valor={novaSenha}
        aoMudar={setNovaSenha}
        autoComplete="new-password"
        descritoPor="regras-da-nova-senha"
        referencia={campoDaNovaSenha}
      >
        <p id="regras-da-nova-senha" className="ajuda">
          {textos.acesso.regras_senha(LIMITE_MINIMO_DE_SENHA, LIMITE_MAXIMO_DE_SENHA)}
        </p>
      </CampoDeSenha>

      <CampoDeSenha
        id="campo-confirmacao-da-nova-senha"
        rotulo={textos.conta.confirmacaoDaSenha}
        valor={confirmacao}
        aoMudar={setConfirmacao}
        autoComplete="new-password"
        referencia={campoDaConfirmacao}
      />

      {falha !== null && (
        <p
          className="aviso aviso--erro"
          role="alert"
          aria-label={textos.conta.falhaAoTrocarSenha}
        >
          <TextoDoProduto texto={falha} />
        </p>
      )}

      {incerto && (
        <div
          className="aviso aviso--erro"
          role="alert"
          aria-label={textos.conta.resultadoDesconhecido}
        >
          <p>{textos.conta.desconhecidoSenha}</p>
          <div className="acoes">
            <button
              className="botao botao--primario"
              type="button"
              onClick={() => void conferir()}
            >
              {textos.comum.tentarNovamente}
            </button>
            <button
              className="botao botao--secundario"
              type="button"
              onClick={aoIrParaEntrar}
            >
              {textos.conta.irParaEntrar}
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
          {enviando ? textos.conta.trocando : textos.conta.trocarSenha}
        </button>
        <button
          className="botao botao--secundario"
          type="button"
          disabled={enviando}
          onClick={aoCancelar}
        >
          {textos.conta.cancelar}
        </button>
      </div>
    </form>
  );
}
