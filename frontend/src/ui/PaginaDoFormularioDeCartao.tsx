import { pt } from "../idioma/pt";
import { TextoDoProduto } from "../idioma";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useIdioma } from "../idioma";
import { CampoDeTags } from "./CampoDeTags";

import type {
  Cartao,
  ClienteDoAcervo,
  TipoDeCartao,
} from "../acervo-cliente/cliente";
import {
  FORMATOS_DE_IMAGEM,
  LIMITE_DA_DESCRICAO_ALTERNATIVA,
  ORDEM_DOS_TIPOS,
  conferirArquivoDeImagem,
  textoAlternativoDa,
} from "../acervo-cliente/tipos-de-cartao";
import {
  LIMITE_DE_CARACTERES_DE_CARTAO,
  ehCodigoDeErroDeCartao,
  type CodigoDeErroDeCartao,
} from "../acervo-cliente/validacao";
import { DialogoDeConfirmacao } from "./DialogoDeConfirmacao";
import { EstadoDaCarga } from "./EstadoDaCarga";
import { ImagemDoCartao } from "./tipos-de-cartao/ImagemDoCartao";
import { guardarAvisoDeCartao } from "./aviso-de-cartao";
import { irParaRota } from "./navegacao";
import {
  useNavegarSemProtecao,
  useProtecaoDeSaida,
} from "./protecao-de-saida";

/**
 * Página do formulário de Cartão — criação e edição (T1113;
 * specs/025-criar-cartoes-baralho/contracts/ui.md; FR-025, FR-388, FR-393,
 * FR-394, FR-396, FR-398, FR-399, FR-148, FR-153, FR-154, FR-155, FR-156).
 *
 * Desde a `026`, a criação começa por um seletor de Tipo de cartão, sempre em
 * Frente-Verso (FR-404, FR-405), e os campos se adaptam ao tipo escolhido; a
 * edição mostra o tipo e não deixa mudá-lo (FR-420). No tipo Imagem, o
 * arquivo só é enviado ao salvar (research R4), e a pré-visualização é local
 * (FR-413) — contrato em specs/026-cartao-com-imagem/contracts/ui.md.
 *
 * A criação e edição ocorrem dentro de um Baralho (`baralhoId` obrigatório).
 * Sem `id`, é a criação (`#/baralhos/{baralhoId}/cartoes/novo`); com `id`, é a
 * edição do Cartão correspondente. Concentra as mesmas regras, limites e
 * mensagens das features 001 e 005 — o limite de caracteres é comunicado
 * durante a digitação (FR-053), mas quem recusa conteúdo continua sendo o
 * `ClienteDoAcervo`, e a mensagem exibida é exatamente a devolvida pela
 * Interface (FR-046).
 *
 * Na criação, `criarCartao(baralhoId, dados)` devolve a Frente final (pode
 * ser numerada como "X (2)" se houver colisão; FR-398). Na edição, colisão de
 * Frente é recusada com `frente_duplicada` (FR-399). Cancelar volta para a
 * página anterior, de onde quer que o formulário tenha sido aberto.
 *
 * A proteção de saída (FR-148, FR-154) vem de `protecao-de-saida`: com o
 * formulário sujo, sair exige confirmação; com um salvamento em andamento, a
 * navegação é bloqueada e o motivo é anunciado. Concluído o salvamento, a
 * proteção é descartada e a interface volta para o detalhe do Baralho.
 */

/**
 * Folga a partir da qual a aproximação do limite passa a ser comunicada
 * explicitamente. Decisão de apresentação, não regra de domínio: a recusa de
 * conteúdo acima do limite permanece exclusiva do `ClienteDoAcervo`.
 */
const FOLGA_PARA_AVISO_DE_LIMITE = 100;

/**
 * Campo a corrigir para cada recusa de regra de Cartão (FR-055, FR-155).
 *
 * A página não reproduz nenhuma regra de domínio: qual campo precisa de
 * correção é decidido exclusivamente pelo código estável devolvido pela
 * Interface, e este mapa apenas o traduz em direção de foco. `indisponivel`
 * fica de fora de propósito — na falha de transporte, nenhum campo precisa de
 * correção e o foco permanece onde estava.
 */
type Campo = "frente" | "verso" | "imagem" | "descricao";

const CAMPO_PARA_CORRECAO: Readonly<
  Record<CodigoDeErroDeCartao, Campo | null>
> = {
  frente_vazia: "frente",
  frente_muito_longa: "frente",
  verso_vazio: "verso",
  verso_muito_longo: "verso",
  imagem_ausente: "imagem",
  imagem_invalida: "imagem",
  descricao_muito_longa: "descricao",
  // Sem seletor na edição, a recusa de tipo não aponta campo algum.
  tipo_imutavel: null,
};


export const MOTIVO_DE_PENDENCIA = pt.cartao.pendenciaDeSalvamento;

interface PropriedadesDoFormularioDeCartao {
  cliente: ClienteDoAcervo;
  baralhoId: string;
  id?: string;
}

export function PaginaDoFormularioDeCartao({
  cliente,
  baralhoId,
  id,
}: PropriedadesDoFormularioDeCartao) {
  const { textos } = useIdioma();
  const emEdicao = id !== undefined;

  const [carregando, setCarregando] = useState(emEdicao);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [falhaDeCarga, setFalhaDeCarga] = useState<string | null>(null);

  const [frente, setFrente] = useState("");
  const [verso, setVerso] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [referencia, setReferencia] = useState({ frente: "", verso: "", tags: [] as string[] });
  const [salvando, setSalvando] = useState(false);
  const [falhaDeSalvamento, setFalhaDeSalvamento] = useState<string | null>(
    null,
  );
  const [campoComErro, setCampoComErro] = useState<Campo | null>(null);

  // 026 — Tipo de cartão e Imagem.
  const [tipo, setTipo] = useState<TipoDeCartao>("frente-verso");
  const [textoAlternativo, setTextoAlternativo] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [imagemAtual, setImagemAtual] = useState<Cartao["imagem"]>(undefined);
  const [imagemRemovida, setImagemRemovida] = useState(false);
  const [falhaDaImagem, setFalhaDaImagem] = useState<string | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const [referenciaDoTipo, setReferenciaDoTipo] = useState({ textoAlternativo: "" });

  const campoDeFrente = useRef<HTMLTextAreaElement>(null);
  const campoDeVerso = useRef<HTMLTextAreaElement>(null);
  const campoDeTipo = useRef<HTMLSelectElement>(null);
  const campoDeImagem = useRef<HTMLInputElement>(null);
  const campoDeDescricao = useRef<HTMLTextAreaElement>(null);

  const ehImagem = tipo === "imagem";
  const estaSujo =
    frente !== referencia.frente ||
    verso !== referencia.verso ||
    JSON.stringify(tags) !== JSON.stringify(referencia.tags) ||
    arquivo !== null ||
    imagemRemovida ||
    textoAlternativo !== referenciaDoTipo.textoAlternativo ||
    (!emEdicao && tipo !== "frente-verso");

  // A pré-visualização é um endereço local do arquivo escolhido, liberado
  // quando o arquivo muda ou o formulário sai da tela (FR-413).
  useEffect(() => {
    if (arquivo === null || typeof URL.createObjectURL !== "function") {
      setPrevia(null);
      return;
    }

    let endereco: string;

    try {
      endereco = URL.createObjectURL(arquivo);
    } catch {
      // Sem pré-visualização local possível, o formulário segue sem ela.
      setPrevia(null);
      return;
    }

    setPrevia(endereco);

    return () => URL.revokeObjectURL(endereco);
  }, [arquivo]);

  const navegarSemProtecao = useNavegarSemProtecao();

  const avisoDeLimite = (comprimento: number): string | null => {
    const restantes = LIMITE_DE_CARACTERES_DE_CARTAO - comprimento;

    if (restantes > FOLGA_PARA_AVISO_DE_LIMITE) {
      return null;
    }

    if (restantes < 0) {
      return textos.cartao.aviseLimiteExcedido(LIMITE_DE_CARACTERES_DE_CARTAO);
    }

    if (restantes === 0) {
      return textos.cartao.aviseLimiteCheio(LIMITE_DE_CARACTERES_DE_CARTAO);
    }

    return textos.cartao.aviseLimite(restantes, LIMITE_DE_CARACTERES_DE_CARTAO);
  };

  // Há uma única proteção vigente e a pendência tem precedência: enquanto o
  // salvamento corre, sair é bloqueado e o motivo é anunciado (FR-154); fora
  // dele, sair com conteúdo diferente do inicial pede confirmação (FR-148).
  // Duas chamadas de `useProtecaoDeSaida` não servem aqui: a última gravaria
  // por cima da primeira e o descarte venceria a pendência, liberando a
  // navegação exatamente quando ela precisa ficar parada.
  const protecaoDeDescarte = {
    tipo: "descarte" as const,
    titulo: textos.cartao.descartarAlteracoes,
    descricao: textos.cartao.descartarTexto,
    rotuloDeConfirmacao: textos.cartao.descartarConfirm,
  };

  useProtecaoDeSaida(
    salvando
      ? { tipo: "pendencia", motivo: textos.cartao.pendenciaDeSalvamento }
      : estaSujo
        ? protecaoDeDescarte
        : null,
  );

  useEffect(() => {
    if (!emEdicao) {
      return;
    }

    let ativo = true;

    void (async () => {
      const listagem = await cliente.listarCartoes();

      if (!ativo) {
        return;
      }

      if (!listagem.ok) {
        setFalhaDeCarga(listagem.mensagem);
        setCarregando(false);
        return;
      }

      const encontrado = listagem.cartoes.find((item) => item.id === id);

      if (encontrado === undefined) {
        setNaoEncontrado(true);
        setCarregando(false);
        return;
      }

      setFrente(encontrado.frente);
      setVerso(encontrado.verso);
      setTags(encontrado.tags ?? []);
      setTipo(encontrado.tipo ?? "frente-verso");
      setImagemAtual(encontrado.imagem);
      setTextoAlternativo(encontrado.textoAlternativo ?? "");
      setReferenciaDoTipo({ textoAlternativo: encontrado.textoAlternativo ?? "" });
      setReferencia({
        frente: encontrado.frente,
        verso: encontrado.verso,
        tags: encontrado.tags ?? [],
      });
      setCarregando(false);
    })();

    return () => {
      ativo = false;
    };
  }, [cliente, id, emEdicao]);

  // `useLayoutEffect`, e não `useEffect`: o foco precisa ser movido na mesma
  // tarefa da mutação do DOM. Um `useEffect` só corre depois da pintura, e o
  // intervalo entre a montagem do formulário e a pintura seguinte deixa o
  // foco no `<body>` — quem observa o DOM logo após o commit (leitor de tela,
  // teste) vê o foco perdido antes de ele chegar ao campo (ordem de foco da
  // WCAG; nenhum foco transitório no `<body>`). `PaginaDoBaralho.tsx` usa o
  // mesmo recurso para o foco após remoção.
  useLayoutEffect(() => {
    if (emEdicao && !carregando && !naoEncontrado) {
      campoDeFrente.current?.focus();
    }
  }, [emEdicao, carregando, naoEncontrado]);

  /** Leva o foco ao campo que precisa de correção. */
  function focarCampo(campo: Campo) {
    setCampoComErro(campo);
    const alvo = {
      frente: campoDeFrente,
      verso: campoDeVerso,
      imagem: campoDeImagem,
      descricao: campoDeDescricao,
    }[campo];

    alvo.current?.focus();
  }

  /** Troca os campos pelo tipo escolhido e anuncia a troca (FR-404, FR-425). */
  function aplicarTipo(novo: TipoDeCartao) {
    setTipo(novo);
    setCampoComErro(null);
    setFalhaDaImagem(null);
    const anuncio = novo === "frente-verso"
      ? textos.cartao.anunciarFrenteVerso
      : textos.cartao.anunciarImagem;
    setAnuncio(anuncio);
  }

  function escolherTipo(novo: TipoDeCartao) {
    // Voltar a Frente-Verso com uma Imagem escolhida pede confirmação (FR-406).
    if (novo === "frente-verso" && arquivo !== null) {
      setConfirmandoDescarte(true);
      return;
    }

    aplicarTipo(novo);
  }

  function fecharDescarte(descartar: boolean) {
    setConfirmandoDescarte(false);

    if (descartar) {
      setArquivo(null);
      aplicarTipo("frente-verso");
    }

    campoDeTipo.current?.focus();
  }

  function escolherArquivo(lista: FileList | null) {
    const escolhido = lista?.[0];

    if (escolhido === undefined) {
      return;
    }

    const recusa = conferirArquivoDeImagem(escolhido);

    if (recusa !== null) {
      // O arquivo recusado não fica escolhido; os outros campos permanecem.
      if (campoDeImagem.current !== null) {
        campoDeImagem.current.value = "";
      }
      setFalhaDaImagem(recusa.mensagem);
      focarCampo("imagem");
      return;
    }

    setFalhaDaImagem(null);
    setCampoComErro(null);
    setArquivo(escolhido);
    setImagemRemovida(false);
  }

  function removerImagem() {
    setArquivo(null);
    if (campoDeImagem.current !== null) {
      campoDeImagem.current.value = "";
    }
    if (emEdicao) {
      setImagemRemovida(true);
    }
    campoDeImagem.current?.focus();
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setFalhaDeSalvamento(null);
    setFalhaDaImagem(null);
    setCampoComErro(null);

    // Na edição, a Imagem removida sem outra no lugar não pode ser salva: o
    // tipo Imagem exige uma (US3-3).
    if (ehImagem && emEdicao && imagemRemovida && arquivo === null) {
      setFalhaDeSalvamento(textos.cartao.naoEscolheuImagem);
      focarCampo("imagem");
      setSalvando(false);
      return;
    }

    let imagemId: string | undefined;

    if (ehImagem && arquivo !== null) {
      setAnuncio(textos.cartao.btnEnviandoImagem);
      const enviada = await cliente.enviarImagem(arquivo);

      if (!enviada.ok) {
        setAnuncio("");
        setFalhaDeSalvamento(enviada.mensagem);
        if (enviada.erro === "formato" || enviada.erro === "tamanho") {
          focarCampo("imagem");
        }
        setSalvando(false);
        return;
      }

      imagemId = enviada.imagemId;
    }

    const doTipo = ehImagem
      ? {
          tipo: "imagem" as const,
          ...(imagemId !== undefined ? { imagemId } : {}),
          ...(textoAlternativo ? { textoAlternativo } : {}),
        }
      : {};

    const resultado = emEdicao
      ? await cliente.editarCartao(id, frente, verso, tags, doTipo)
      : await cliente.criarCartao(baralhoId, { frente, verso, tags, ...doTipo });

    if (resultado.ok) {
      setReferencia({ frente, verso, tags });
      setArquivo(null);
      setImagemRemovida(false);
      setReferenciaDoTipo({ textoAlternativo });
      if (!emEdicao) {
        guardarAvisoDeCartao(
          baralhoId,
          textos.cartao.cartaoCriado(resultado.cartao.frente),
        );
      }
      // Sucesso na criação ou edição: volta para o detalhe do Baralho.
      navegarSemProtecao(
        `#/baralhos/${encodeURIComponent(baralhoId)}`
      );
      return;
    }

    setAnuncio("");
    setFalhaDeSalvamento(resultado.mensagem);

    // FR-055, FR-155, FR-399, FR-425: numa recusa, o foco vai ao campo que
    // precisa de correção. A direção vem só do código devolvido pela
    // Interface — a página não decide qual conteúdo é inválido, apenas para
    // onde mover o foco. Na falha de transporte, nenhum campo é apontado.
    if (resultado.erro === "frente_duplicada" || ehCodigoDeErroDeCartao(resultado.erro)) {
      const campo = resultado.erro === "frente_duplicada"
        ? "frente"
        : CAMPO_PARA_CORRECAO[resultado.erro];

      // A Imagem recusada pelo servidor deixa de estar escolhida, e o campo
      // volta a pedir um arquivo; os textos permanecem (US1-6).
      if (resultado.erro === "imagem_invalida") {
        setArquivo(null);
      }

      if (campo !== null) {
        focarCampo(campo);
      }
    }

    setSalvando(false);
  }

  if (carregando) {
    return (
      <div className="pagina">
        <h1>{emEdicao ? textos.cartao.editarCartao : textos.cartao.criarCartao}</h1>
        <EstadoDaCarga estado="carregando" mensagem={textos.cartao.carregandoCartoes} />
      </div>
    );
  }

  if (naoEncontrado) {
    return (
      <div className="pagina">
        <h1>{textos.cartao.cartaoNaoEncontrado}</h1>
        <p className="aviso aviso--erro" role="alert">
          {textos.cartao.cartaoNaoEncontradoMsg}
        </p>
      </div>
    );
  }

  if (falhaDeCarga !== null) {
    return (
      <div className="pagina">
        <h1>{emEdicao ? textos.cartao.editarCartao : textos.cartao.criarCartao}</h1>
        <EstadoDaCarga
          estado="falha"
          mensagem={falhaDeCarga}
          aoTentarNovamente={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="pagina">
      <h1>{emEdicao ? textos.cartao.editarCartao : textos.cartao.criarCartao}</h1>

      <div className="cartao">
        <form className="formulario" onSubmit={salvar}>
          <p className="visualmente-oculto" aria-live="polite">
            {anuncio}
          </p>

          {emEdicao ? (
            <p className="ajuda">{textos.cartao.tipoAtual(textos.cartao.nomeDoTipo[tipo])}</p>
          ) : (
            <div className="campo">
              <label htmlFor="campo-tipo" className="rotulo">
                {textos.cartao.tipoCartaoLabel}
              </label>
              <select
                id="campo-tipo"
                ref={campoDeTipo}
                value={tipo}
                onChange={(evento) => escolherTipo(evento.target.value as TipoDeCartao)}
              >
                {ORDEM_DOS_TIPOS.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {textos.cartao.nomeDoTipo[opcao]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {ehImagem && (
            <>
              <div className="campo">
                <label htmlFor="campo-imagem" className="rotulo">
                  {textos.cartao.imagemLabel}
                </label>
                <input
                  id="campo-imagem"
                  ref={campoDeImagem}
                  type="file"
                  accept={FORMATOS_DE_IMAGEM.join(",")}
                  className={arquivo !== null || (imagemAtual !== undefined && !imagemRemovida) ? "visualmente-oculto" : undefined}
                  onChange={(evento) => escolherArquivo(evento.target.files)}
                  aria-invalid={campoComErro === "imagem" ? true : undefined}
                  aria-describedby={`ajuda-da-imagem${falhaDaImagem !== null ? " erro-da-imagem" : campoComErro === "imagem" ? " erro-do-formulario" : ""}`}
                />
                <p id="ajuda-da-imagem" className="ajuda">
                  {textos.cartao.imagemHint}
                </p>
                {falhaDaImagem !== null && (
                  <p id="erro-da-imagem" className="erro" role="alert">
                    <TextoDoProduto texto={falhaDaImagem} />
                  </p>
                )}
                {(previa !== null || arquivo !== null || (imagemAtual !== undefined && !imagemRemovida)) && (
                  <div className="previa-da-imagem">
                    <ImagemDoCartao
                      url={previa ?? (arquivo === null ? imagemAtual?.url ?? null : null)}
                      textoAlternativo={arquivo?.name ?? textoAlternativoDa({ frente, textoAlternativo }, textos.cartao.imagemSemDescricao)}
                      variante="previa"
                    />
                    <div className="acoes">
                      <button
                        type="button"
                        className="botao botao--secundario"
                        onClick={() => campoDeImagem.current?.click()}
                      >
                        {textos.cartao.btnTrocarImagem}
                      </button>
                      <button
                        type="button"
                        className="botao botao--secundario"
                        onClick={removerImagem}
                      >
                        {textos.cartao.btnRemoverImagem}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="campo">
                <label htmlFor="campo-descricao" className="rotulo">
                  {textos.cartao.descricaoLabel}
                </label>
                <textarea
                  id="campo-descricao"
                  ref={campoDeDescricao}
                  value={textoAlternativo}
                  onChange={(evento) => { setTextoAlternativo(evento.target.value); setCampoComErro(null); }}
                  aria-invalid={campoComErro === "descricao" ? true : undefined}
                  aria-describedby={`ajuda-da-descricao contador-da-descricao${campoComErro === "descricao" ? " erro-do-formulario" : ""}`}
                />
                <p id="ajuda-da-descricao" className="ajuda">
                  {textos.cartao.descricaoHint}
                </p>
                <p id="contador-da-descricao" className="contador">
                  {textoAlternativo.length} / {LIMITE_DA_DESCRICAO_ALTERNATIVA} {textos.cartao.caracteres}
                </p>
              </div>
            </>
          )}

          <div className="campo">
            <label htmlFor="campo-frente" className="rotulo">
              {ehImagem ? textos.cartao.textoFrenteFront : textos.cartao.textoFrente}
            </label>
            <textarea
              id="campo-frente"
              ref={campoDeFrente}
              value={frente}
              onChange={(evento) => { setFrente(evento.target.value); setCampoComErro(null); }}
              aria-invalid={campoComErro === "frente" ? true : undefined}
              aria-describedby={
                avisoDeLimite(frente.length) === null
                  ? `contador-da-frente${campoComErro === "frente" ? " erro-do-formulario" : ""}`
                  : `contador-da-frente aviso-da-frente${campoComErro === "frente" ? " erro-do-formulario" : ""}`
              }
            />
            <p id="contador-da-frente" className="contador">
              {frente.length} / {LIMITE_DE_CARACTERES_DE_CARTAO} {textos.cartao.caracteres}
            </p>
            {avisoDeLimite(frente.length) !== null && (
              <p id="aviso-da-frente" className="aviso-de-limite">
                {avisoDeLimite(frente.length)}
              </p>
            )}
          </div>

          <div className="campo">
            <label htmlFor="campo-verso" className="rotulo">
              {textos.cartao.textoVerso}
            </label>
            <textarea
              id="campo-verso"
              ref={campoDeVerso}
              value={verso}
              onChange={(evento) => { setVerso(evento.target.value); setCampoComErro(null); }}
              aria-invalid={campoComErro === "verso" ? true : undefined}
              aria-describedby={
                avisoDeLimite(verso.length) === null
                  ? `contador-do-verso${campoComErro === "verso" ? " erro-do-formulario" : ""}`
                  : `contador-do-verso aviso-do-verso${campoComErro === "verso" ? " erro-do-formulario" : ""}`
              }
            />
            <p id="contador-do-verso" className="contador">
              {verso.length} / {LIMITE_DE_CARACTERES_DE_CARTAO} {textos.cartao.caracteres}
            </p>
            {avisoDeLimite(verso.length) !== null && (
              <p id="aviso-do-verso" className="aviso-de-limite">
                {avisoDeLimite(verso.length)}
              </p>
            )}
          </div>

          <CampoDeTags tags={tags} aoAlterar={setTags} />

          {falhaDeSalvamento !== null && (
            <p
              id="erro-do-formulario"
              className="erro"
              role="alert"
              aria-label={
                emEdicao
                  ? textos.cartao.falhaNaEdicao
                  : textos.cartao.falhaNaCriacao
              }
            >
              <TextoDoProduto texto={falhaDeSalvamento} />
            </p>
          )}

          <div className="acoes">
            <button
              className="botao botao--primario"
              type="submit"
              disabled={salvando}
            >
              {salvando ? (ehImagem && arquivo !== null ? textos.cartao.btnEnviandoImagem : textos.cartao.btnSalvando) : textos.cartao.btnSalvar}
            </button>
            <button
              className="botao botao--secundario"
              type="button"
              onClick={() => voltarParaAPaginaAnterior(baralhoId)}
            >
              {textos.cartao.btnCancelar}
            </button>
          </div>
        </form>
      </div>

      <DialogoDeConfirmacao
        aberto={confirmandoDescarte}
        titulo={textos.cartao.descartarImagemTitle}
        rotuloDeConfirmacao={textos.cartao.descartarImagemConfirm}
        aoConfirmar={() => fecharDescarte(true)}
        aoCancelar={() => fecharDescarte(false)}
      >
        {textos.cartao.descartarImagemMsg}
      </DialogoDeConfirmacao>
    </div>
  );
}

/**
 * Cancelar volta para a página de onde o formulário foi aberto (Baralho).
 * Sem página anterior no histórico — o formulário aberto direto pela URL —,
 * a volta é para o detalhe do Baralho. A volta passa por `hashchange`, e por
 * isso a proteção de saída continua valendo com o formulário sujo.
 */
function voltarParaAPaginaAnterior(baralhoId: string): void {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  // Fallback se não houver histórico — vai para o detalhe do Baralho.
  irParaRota(`#/baralhos/${encodeURIComponent(baralhoId)}`);
}
