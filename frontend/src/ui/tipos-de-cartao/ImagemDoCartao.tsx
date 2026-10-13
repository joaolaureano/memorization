import { useEffect, useRef, useState } from "react";

/**
 * A Imagem de um Cartão do tipo Imagem, como aparece no Baralho, na Sessão e
 * na pré-visualização do formulário (026).
 *
 * - Aparece direto, sem link nem passo extra (FR-415), inteira e sem
 *   distorção (FR-417, `object-fit: contain` no CSS).
 * - O texto alternativo vem de quem chama, já resolvido pela regra de FR-426.
 * - Se a Imagem não carrega, pede uma vez novos endereços (`aoFalhar`); se
 *   continua sem carregar, mostra o aviso de Imagem indisponível com a
 *   Descrição, sem interromper nada (FR-418).
 * - Com movimento reduzido pedido pelo sistema, desenha só o primeiro quadro
 *   num `<canvas>` — um GIF animado fica parado (FR-429).
 */

interface PropriedadesDaImagemDoCartao {
  /** Endereço da Imagem; `null` quando o servidor não o emitiu. */
  url: string | null;
  textoAlternativo: string;
  /** Descrição alternativa, repetida no aviso de indisponível. */
  descricao?: string;
  variante: "miniatura" | "face" | "previa";
  /** Chamado na primeira falha de carga, para renovar os endereços. */
  aoFalhar?: () => void;
}

/** Diz se o sistema pede movimento reduzido. */
function pedeMovimentoReduzido(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function ImagemDoCartao({
  url,
  textoAlternativo,
  descricao,
  variante,
  aoFalhar,
}: PropriedadesDaImagemDoCartao) {
  const [falhas, setFalhas] = useState(0);
  const [reduzido] = useState(pedeMovimentoReduzido);
  const tela = useRef<HTMLCanvasElement>(null);
  const classe = `imagem-do-cartao imagem-do-cartao--${variante}`;

  function falhou() {
    if (falhas === 0) {
      aoFalhar?.();
    }
    setFalhas((anterior) => anterior + 1);
  }

  // Movimento reduzido: o primeiro quadro, parado, numa tela.
  useEffect(() => {
    if (!reduzido || url === null || tela.current === null) {
      return;
    }

    const imagem = new Image();
    imagem.onload = () => {
      const alvo = tela.current;
      const contexto = alvo?.getContext("2d");

      if (alvo && contexto) {
        alvo.width = imagem.naturalWidth;
        alvo.height = imagem.naturalHeight;
        contexto.drawImage(imagem, 0, 0);
      }
    };
    imagem.onerror = falhou;
    imagem.src = url;
    // `falhou` só muda o estado local: o efeito depende só do endereço.
  }, [reduzido, url]);

  const indisponivel = url === null || falhas >= (aoFalhar ? 2 : 1);

  if (indisponivel) {
    return (
      <div className={`${classe} imagem-do-cartao--indisponivel`} role="img" aria-label={textoAlternativo}>
        <span className="imagem-do-cartao__aviso">Imagem indisponível</span>
        {descricao && variante !== "miniatura" && (
          <span className="imagem-do-cartao__descricao">{descricao}</span>
        )}
      </div>
    );
  }

  if (reduzido) {
    return <canvas ref={tela} className={classe} role="img" aria-label={textoAlternativo} />;
  }

  return <img className={classe} src={url} alt={textoAlternativo} onError={falhou} />;
}
