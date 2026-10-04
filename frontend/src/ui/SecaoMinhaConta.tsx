import { useEffect, useRef, useState } from "react";

import type {
  ClienteDoAcervo,
  Credencial,
  DadosDaConta,
} from "../acervo-cliente/cliente";
import { DialogoDeExclusaoDeConta } from "./DialogoDeExclusaoDeConta";
import { FormularioDeTrocaDeSenha } from "./FormularioDeTrocaDeSenha";

/**
 * Seção «Minha conta» (017; FR-257, FR-258), renderizada dentro do Perfil —
 * a navegação principal não ganha destino novo.
 *
 * O Nome de usuário é somente leitura (FR-336): a tela o exibe, sem botão,
 * campo ou formulário para alterá-lo. As ações restantes são «Trocar Senha» e
 * «Excluir conta». **Nenhum campo exibe a Senha**, e nenhum caminho oferece
 * recuperá-la. Cada ação abre o seu formulário ou diálogo, um de cada vez, e
 * devolve o foco ao botão que a abriu ao fechar (FR-285).
 *
 * O servidor é a fonte do que aparece: o Nome de usuário e as contagens vêm de
 * `obterConta`, e a falha de carregamento oferece «Tentar novamente» sem
 * impedir o restante da tela de Preferências (FR-044, FR-045).
 */

type Acao = "senha" | "excluir";

interface PropriedadesDaSecaoMinhaConta {
  cliente: ClienteDoAcervo;
  /** Substitui a Credencial em memória após trocar a Senha (FR-270). */
  aoSubstituirCredencial: (nova: Credencial) => void;
  /** Descarta a Credencial e vai a Entrar com «Conta excluída» (FR-276). */
  aoExcluirConta: () => void;
  /** Descarta a Credencial e vai a Entrar quando o resultado é desconhecido (FR-282). */
  aoIrParaEntrar: () => void;
}

export function SecaoMinhaConta({
  cliente,
  aoSubstituirCredencial,
  aoExcluirConta,
  aoIrParaEntrar,
}: PropriedadesDaSecaoMinhaConta) {
  const [dados, setDados] = useState<DadosDaConta | null>(null);
  const [falhaDeCarregamento, setFalhaDeCarregamento] = useState<string | null>(
    null,
  );
  const [numeroDaTentativa, setNumeroDaTentativa] = useState(0);
  const [acao, setAcao] = useState<Acao | null>(null);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);

  const botaoDaSenha = useRef<HTMLButtonElement>(null);
  const botaoDeExcluir = useRef<HTMLButtonElement>(null);
  const aberturaAnterior = useRef<Acao | null>(null);

  // A leitura é refeita quando o cliente muda — a Credencial foi substituída —,
  // sem esconder o que já está na tela enquanto isso.
  useEffect(() => {
    let ativo = true;

    setFalhaDeCarregamento(null);

    void cliente.obterConta().then((resultado) => {
      if (!ativo) {
        return;
      }

      if (resultado.ok) {
        setDados(resultado.dados);
      } else {
        setFalhaDeCarregamento(resultado.mensagem);
      }
    });

    return () => {
      ativo = false;
    };
  }, [cliente, numeroDaTentativa]);

  // FR-285: ao fechar a ação, o foco volta ao botão que a abriu.
  useEffect(() => {
    if (acao === null && aberturaAnterior.current !== null) {
      const botao = {
        senha: botaoDaSenha,
        excluir: botaoDeExcluir,
      }[aberturaAnterior.current];

      botao.current?.focus();
    }

    aberturaAnterior.current = acao;
  }, [acao]);

  function fechar(): void {
    setAcao(null);
  }

  return (
    <section className="cartao" aria-labelledby="titulo-minha-conta">
      <h2 id="titulo-minha-conta">Minha conta</h2>

      {dados === null ? (
        falhaDeCarregamento !== null ? (
          <>
            <p
              className="erro"
              role="alert"
              aria-label="Falha ao carregar a conta"
            >
              {falhaDeCarregamento}
            </p>
            <div className="acoes">
              <button
                className="botao botao--primario"
                type="button"
                onClick={() => setNumeroDaTentativa((atual) => atual + 1)}
              >
                Tentar novamente
              </button>
            </div>
          </>
        ) : (
          <p className="carregando">Carregando a conta…</p>
        )
      ) : (
        <>
          <p>
            Nome de usuário: <strong>{dados.nomeDeUsuario}</strong>
          </p>

          {confirmacao !== null && (
            <p className="aviso aviso--sucesso" role="status">
              {confirmacao}
            </p>
          )}

          {acao === null && (
            <div className="acoes">
              <button
                ref={botaoDaSenha}
                className="botao botao--secundario"
                type="button"
                onClick={() => {
                  setConfirmacao(null);
                  setAcao("senha");
                }}
              >
                Trocar Senha
              </button>
              <button
                ref={botaoDeExcluir}
                className="botao botao--perigo"
                type="button"
                onClick={() => {
                  setConfirmacao(null);
                  setAcao("excluir");
                }}
              >
                Excluir conta
              </button>
            </div>
          )}

          {acao === "senha" && (
            <FormularioDeTrocaDeSenha
              cliente={cliente}
              nomeDeUsuario={dados.nomeDeUsuario}
              aoConcluir={(nova) => {
                setConfirmacao("Senha trocada.");
                fechar();
                aoSubstituirCredencial(nova);
              }}
              aoCancelar={fechar}
              aoIrParaEntrar={aoIrParaEntrar}
            />
          )}

          {acao === "excluir" && (
            <DialogoDeExclusaoDeConta
              cliente={cliente}
              nomeDeUsuario={dados.nomeDeUsuario}
              contagens={dados.contagens}
              aoExcluir={aoExcluirConta}
              aoCancelar={fechar}
              aoIrParaEntrar={aoIrParaEntrar}
            />
          )}
        </>
      )}
    </section>
  );
}
