import { TextoDoProduto, useIdioma, type Catalogo } from "../idioma";
import { MENSAGENS_PT } from "../idioma/mensagens";
import { useRef, useState } from "react";

import { INDISPONIVEL } from "../acervo-cliente/cliente";
import type {
  ClienteDoAcervo,
  ContagensDaConta,
} from "../acervo-cliente/cliente";
import { verificarResultadoIncerto } from "../conta/verificar-resultado";
import { CampoDeSenha } from "./CampoDeSenha";
import { DialogoDeConfirmacao } from "./DialogoDeConfirmacao";
import { useProtecaoDeSaida } from "./protecao-de-saida";
import type { Protecao } from "./protecao-de-saida";

/**
 * Diálogo «Excluir conta» (017; FR-272..FR-278).
 *
 * Anuncia que a exclusão é **irreversível** e o que será removido, com as
 * contagens vindas do servidor — Cartões, Baralhos, Registros de sessão e, quando
 * o servidor as informa, os dados da Agenda (FR-272, SC-113) —, e exige a Senha
 * atual (FR-273). O foco inicial vai ao cancelamento, como em todo diálogo de
 * exclusão da interface. `senha_atual_incorreta` mostra a mensagem única, apaga
 * o campo de Senha e mantém o diálogo aberto (FR-279).
 *
 * No sucesso, `aoExcluir` descarta a Credencial e leva a Entrar com «Conta
 * excluída» (FR-276). Resposta perdida: a tela não anuncia nada antes de
 * verificar se a Credencial antiga ainda vale — vale, nada foi excluído; não
 * vale, a conta foi excluída; sem como saber, oferece «Tentar novamente» e «Ir
 * para Entrar» (FR-280..FR-283).
 */

export const MENSAGEM_DE_RESULTADO_DESCONHECIDO_DA_EXCLUSAO = MENSAGENS_PT.resultadoDesconhecidoDaExclusao;

export const MENSAGEM_DE_CONTA_NAO_EXCLUIDA = MENSAGENS_PT.contaNaoExcluida;

interface PropriedadesDoDialogoDeExclusaoDeConta {
  cliente: ClienteDoAcervo;
  /** O Nome de usuário da Credencial, para verificar um resultado incerto. */
  nomeDeUsuario: string;
  contagens: ContagensDaConta;
  aoExcluir: () => void;
  aoCancelar: () => void;
  /** Descarta a Credencial e vai a Entrar, quando o resultado é desconhecido. */
  aoIrParaEntrar: () => void;
}

export function DialogoDeExclusaoDeConta({
  cliente,
  nomeDeUsuario,
  contagens,
  aoExcluir,
  aoCancelar,
  aoIrParaEntrar,
}: PropriedadesDoDialogoDeExclusaoDeConta) {
  const { textos } = useIdioma();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [incerto, setIncerto] = useState(false);

  const campoDaSenha = useRef<HTMLInputElement>(null);

  async function conferir(): Promise<void> {
    setEnviando(true);
    setIncerto(false);
    setFalha(null);

    const decisao = await verificarResultadoIncerto(cliente, "excluir", {
      antiga: { nomeDeUsuario, senha: senhaAtual },
    });

    setEnviando(false);

    if (decisao === "excluida") {
      setSenhaAtual("");
      aoExcluir();
    } else if (decisao === "nao_aplicada") {
      setFalha(MENSAGEM_DE_CONTA_NAO_EXCLUIDA);
    } else {
      setIncerto(true);
    }
  }

  async function excluir(): Promise<void> {
    setFalha(null);
    setIncerto(false);
    setEnviando(true);

    const resultado = await cliente.excluirConta({ senhaAtual });

    if (resultado.ok) {
      setEnviando(false);
      setSenhaAtual("");
      aoExcluir();
      return;
    }

    if (resultado.erro === INDISPONIVEL) {
      await conferir();
      return;
    }

    setEnviando(false);
    setFalha(resultado.mensagem);

    if (resultado.erro === "senha_atual_incorreta") {
      setSenhaAtual("");
      campoDaSenha.current?.focus();
    }
  }

  const protecao: Protecao | null = enviando
    ? { tipo: "pendencia", motivo: textos.conta.aguardeExclusao }
    : null;

  useProtecaoDeSaida(protecao);

  return (
    <DialogoDeConfirmacao
      aberto
      titulo={textos.conta.excluirConta2}
      rotuloDeConfirmacao={enviando ? textos.conta.excluindo : textos.conta.excluirConta}
      confirmacaoDesabilitada={enviando || incerto || senhaAtual === ""}
      aoConfirmar={() => void excluir()}
      aoCancelar={() => {
        if (!enviando) {
          aoCancelar();
        }
      }}
    >
      <p>
        <strong>{textos.conta.irreversivel}</strong> {textos.conta.remocaoDescricao}
      </p>
      <ul>
        {descreverContagens(contagens, textos).map((linha) => (
          <li key={linha}>{linha}</li>
        ))}
      </ul>
      <p>
        {textos.conta.nenhumDadoRecuperavel}
      </p>

      <CampoDeSenha
        id="campo-senha-atual-da-exclusao"
        rotulo={textos.conta.senhaAtualExclusao}
        valor={senhaAtual}
        aoMudar={setSenhaAtual}
        autoComplete="current-password"
        referencia={campoDaSenha}
      />

      {falha !== null && (
        <p
          className="aviso aviso--erro"
          role="alert"
          aria-label={textos.conta.falhaAoExcluirConta}
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
          <p><TextoDoProduto texto={MENSAGEM_DE_RESULTADO_DESCONHECIDO_DA_EXCLUSAO} /></p>
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
    </DialogoDeConfirmacao>
  );
}

/** As linhas do que será removido, no singular ou plural certo (FR-272). */
function descreverContagens(
  contagens: ContagensDaConta,
  textos: Catalogo,
): string[] {
  const linhas = [
    textos.conta.linhaCartoes(contagens.cartoes),
    textos.conta.linhaBaralhos(contagens.baralhos),
    textos.conta.linhaRegistrosDeSessao(contagens.registrosDeSessao),
  ];

  if (contagens.agenda !== null) {
    linhas.push(textos.conta.linhaItensDaAgenda(contagens.agenda));
  }

  return linhas;
}
