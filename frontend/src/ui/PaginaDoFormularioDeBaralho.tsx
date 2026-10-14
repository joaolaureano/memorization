import { TextoDoProduto } from "../idioma";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useIdioma } from "../idioma";
import type {
  BaralhoComCartoes,
  ClienteDoAcervo,
} from "../acervo-cliente/cliente";
import {
  LIMITE_DE_CARACTERES_DE_BARALHO,
  ehCodigoDeErroDeBaralho,
} from "../acervo-cliente/validacao";
import { ROTA_PADRAO, hashDaRota } from "./navegacao";
import {
  useNavegarSemProtecao,
  useProtecaoDeSaida,
} from "./protecao-de-saida";
import type { Protecao } from "./protecao-de-saida";
import { CampoDeTags } from "./CampoDeTags";

/**
 * Tela do formulário de Baralho (T1108, T1109;
 * specs/012-interface-visual-navegavel/tasks.md).
 *
 * A mesma tela serve às duas rotas de formulário da `012`: `#/baralhos/novo`
 * (`novo-baralho`, FR-140) e `#/baralhos/<id>/editar` (`editar-baralho`,
 * FR-141). Sem `id`, cria um Baralho; com `id`, carrega o Baralho existente,
 * pré-preenche o nome e o renomeia (FR-015).
 *
 * O conteúdo é submetido à Interface `ClienteDoAcervo` sem que a tela reproduza
 * regra de domínio alguma: o limite de caracteres, as mensagens em português e
 * as recusas — `nome_vazio`, `nome_muito_longo`, `nao_encontrado`,
 * `indisponivel`, `nao_autenticado` — vêm todas do cliente (FR-046). A tela
 * apenas comunica contagem e limite durante a digitação (FR-061), e informa o
 * alcance da renomeação a partir do Baralho carregado (FR-015). A decisão de
 * para onde o foco vai numa recusa vem só do código devolvido, nunca de uma
 * releitura da regra.
 *
 * A saída é protegida enquanto houver algo a perder (FR-148): com o nome
 * divergente do inicial, a navegação passa pela confirmação de descarte
 * (FR-151); com o salvamento em andamento, a navegação é bloqueada e o motivo
 * é anunciado (FR-153, FR-154). No sucesso a proteção é limpa e a tela navega
 * — para o detalhe do Baralho recém-criado ou de volta ao detalhe do Baralho
 * renomeado (FR-144). Uma falha preserva o valor digitado e permite nova
 * tentativa (FR-155); o recurso ausente exibe a mensagem de Baralho não
 * encontrado com o caminho de volta à lista (FR-156).
 */

interface PropriedadesDoFormularioDeBaralho {
  cliente: ClienteDoAcervo;
  /** Ausente na criação (`#/baralhos/novo`); presente na renomeação. */
  id?: string;
}

/**
 * Folga a partir da qual a aproximação do limite passa a ser comunicada.
 * Decisão de apresentação, não regra de domínio: a recusa de conteúdo acima do
 * limite permanece exclusiva do `ClienteDoAcervo`.
 */
const FOLGA_PARA_AVISO_DE_LIMITE_DE_BARALHO = 10;

export function PaginaDoFormularioDeBaralho({
  cliente,
  id,
}: PropriedadesDoFormularioDeBaralho) {
  const { textos } = useIdioma();
  const renomeando = id !== undefined;

  const [nome, setNome] = useState("");
  const [nomeInicial, setNomeInicial] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagsIniciais, setTagsIniciais] = useState<string[]>([]);
  const [baralho, setBaralho] = useState<BaralhoComCartoes | null>(null);
  const [carregando, setCarregando] = useState(renomeando);
  const [naoEncontrado, setNaoEncontrado] = useState<string | null>(null);
  const [falhaDeCarregamento, setFalhaDeCarregamento] = useState<string | null>(
    null,
  );
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  const campoDeNome = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id === undefined) {
      return;
    }

    let ativo = true;

    setCarregando(true);
    setNaoEncontrado(null);
    setFalhaDeCarregamento(null);

    void cliente.obterBaralho(id).then((resultado) => {
      if (!ativo) {
        return;
      }

      if (resultado.ok) {
        setBaralho(resultado.baralho);
        setNome(resultado.baralho.nome);
        setNomeInicial(resultado.baralho.nome);
        setTags(resultado.baralho.tags ?? []);
        setTagsIniciais(resultado.baralho.tags ?? []);
      } else if (resultado.erro === "nao_encontrado") {
        setNaoEncontrado(resultado.mensagem);
      } else {
        setFalhaDeCarregamento(resultado.mensagem);
      }

      setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [cliente, id]);

  const recursoAusente = naoEncontrado !== null;
  const sujo =
    !carregando &&
    !recursoAusente &&
    falhaDeCarregamento === null &&
    nome !== nomeInicial || JSON.stringify(tags) !== JSON.stringify(tagsIniciais);

  // FR-153/FR-154 vencem FR-148: enquanto salva, a navegação é bloqueada (e o
  // motivo anunciado); só depois de estabilizar a operação a proteção volta a
  // ser a de descarte das alterações não salvas.
  const protecao: Protecao | null = salvando
    ? { tipo: "pendencia", motivo: textos.baralhos.pendingSaveBaralho }
    : sujo
      ? {
          tipo: "descarte",
          titulo: textos.baralhos.descartarAlteracoes,
          descricao: textos.baralhos.descartarTexto,
          rotuloDeConfirmacao: textos.baralhos.descartarConfirm,
        }
      : null;

  useProtecaoDeSaida(protecao);

  const navegarSemProtecao = useNavegarSemProtecao();

  async function salvar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setSalvando(true);
    setFalha(null);

    const resultado =
      id === undefined
        ? await cliente.criarBaralho({ nome, tags })
        : await cliente.renomearBaralho(id, nome, tags);

    if (resultado.ok) {
      const idDoBaralho = id === undefined ? resultado.baralho.id : id;
      // FR-144: a navegação de sucesso não pode ser barrada pela proteção de
      // saída que a própria operação criou (o salvamento em andamento).
      navegarSemProtecao(hashDaRota({ nome: "baralho", id: idDoBaralho }));
      return;
    }

    // FR-155: a falha preserva o valor digitado e permite nova tentativa.
    setFalha(resultado.mensagem);

    // FR-059: numa recusa de domínio, o foco vai ao campo que precisa de
    // correção. A direção vem só do código devolvido pela Interface.
    if (ehCodigoDeErroDeBaralho(resultado.erro)) {
      campoDeNome.current?.focus();
    }

    setSalvando(false);
  }

  const linkDeVolta =
    id !== undefined && !recursoAusente
      ? hashDaRota({ nome: "baralho", id })
      : ROTA_PADRAO;

  const rotuloDeVolta =
    id !== undefined && !recursoAusente
      ? textos.baralhos.voltarBaralho
      : textos.baralhos.voltarBaralhos;

  const avisoDeLimite = (comprimento: number): string | null => {
    const restantes = LIMITE_DE_CARACTERES_DE_BARALHO - comprimento;

    if (restantes > FOLGA_PARA_AVISO_DE_LIMITE_DE_BARALHO) {
      return null;
    }

    if (restantes < 0) {
      return textos.baralhos.aviseLimiteExcedido(LIMITE_DE_CARACTERES_DE_BARALHO);
    }

    if (restantes === 0) {
      return textos.baralhos.aviseLimiteCheio(LIMITE_DE_CARACTERES_DE_BARALHO);
    }

    return textos.baralhos.aviseLimite(restantes, LIMITE_DE_CARACTERES_DE_BARALHO);
  };

  const aviso = avisoDeLimite(nome.length);

  const titulo = recursoAusente
    ? textos.baralhos.deckNotFound
    : renomeando
      ? textos.baralhos.renomearBaralho
      : textos.baralhos.criarBaralho;

  return (
    <div className="pagina">
      <p className="voltar">
        <a href={linkDeVolta}>{rotuloDeVolta}</a>
      </p>

      <h1>{titulo}</h1>

      {carregando ? (
        <p className="carregando">{textos.baralhos.carregandoBaralho}</p>
      ) : recursoAusente ? (
        <p className="erro" role="alert" aria-label={textos.baralhos.deckNotFound}>
          <TextoDoProduto texto={naoEncontrado} />
        </p>
      ) : falhaDeCarregamento !== null ? (
        <p className="erro" role="alert" aria-label={textos.baralhos.carregandoBaralho}>
          <TextoDoProduto texto={falhaDeCarregamento} />
        </p>
      ) : (
        <section className="cartao">
          <form
            className="formulario"
            onSubmit={(evento) => void salvar(evento)}
          >
            <div className="campo">
              <label className="rotulo" htmlFor="campo-nome">
                {textos.baralhos.nomeLabel}
              </label>
              <input
                id="campo-nome"
                ref={campoDeNome}
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                aria-describedby={
                  aviso === null
                    ? "contador-do-nome"
                    : "contador-do-nome aviso-do-nome"
                }
              />
              <p id="contador-do-nome" className="contador">
                {nome.length} / {LIMITE_DE_CARACTERES_DE_BARALHO} {textos.baralhos.caracteres}
              </p>
              {aviso !== null && (
                <p id="aviso-do-nome" className="aviso-de-limite">
                  <TextoDoProduto texto={aviso} />
                </p>
              )}
            </div>

            <CampoDeTags tags={tags} aoAlterar={setTags} />

            {renomeando && baralho !== null && (
              <p className="alcance-da-edicao">
                {textos.baralhos.descricaoAlcance(baralho.cartoes.length)}
              </p>
            )}

            {falha !== null && (
              <p
                className="erro"
                role="alert"
                aria-label={textos.baralhos.falhaSalvar}
              >
                <TextoDoProduto texto={falha} />
              </p>
            )}

            <div className="acoes">
              <button
                className="botao botao--primario"
                type="submit"
                disabled={salvando}
              >
                {salvando ? textos.baralhos.salvando : textos.baralhos.salvar}
              </button>
              <a className="botao" href={linkDeVolta}>
                {textos.comum.cancelar}
              </a>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
