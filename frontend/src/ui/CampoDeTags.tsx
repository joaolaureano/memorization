import { useState } from "react";
import { useIdioma } from "../idioma";

/** Campo reutilizável para adicionar tags com Enter e remover cada etiqueta. */
export function CampoDeTags({
  tags,
  aoAlterar,
}: {
  tags: readonly string[];
  aoAlterar: (tags: string[]) => void;
}) {
  const { textos } = useIdioma();
  const [texto, setTexto] = useState("");

  function adicionar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    const tag = texto.trim().toLowerCase();
    if (tag && !tags.includes(tag)) aoAlterar([...tags, tag]);
    setTexto("");
  }

  return (
    <div className="campo campo--tags">
      <label className="rotulo" htmlFor="campo-tag">{textos.cartao.tagsLabel}</label>
      <input id="campo-tag" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={adicionar} placeholder={textos.cartao.tagsPlaceholder} />
      <ul className="lista-de-tags" aria-label={textos.cartao.tagsAriaLabel}>
        {tags.map((tag) => (
          <li key={tag} className="tag">
            <span>{tag}</span>
            <button type="button" aria-label={textos.cartao.removerTagAriaLabel(tag)} onClick={() => aoAlterar(tags.filter((item) => item !== tag))}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OpcoesDeTags({
  opcoes,
  selecionadas,
  aoAlterar,
}: {
  opcoes: readonly string[];
  selecionadas: readonly string[];
  aoAlterar: (tags: string[]) => void;
}) {
  const { textos } = useIdioma();
  if (opcoes.length === 0) return null;
  return (
    <fieldset className="filtro-de-tags">
      <legend>{textos.cartao.tagsFilterLabel}</legend>
      <div className="filtro-de-tags__opcoes">
        {opcoes.map((tag) => (
          <label key={tag}>
            <input type="checkbox" checked={selecionadas.includes(tag)} onChange={(e) => aoAlterar(e.target.checked ? [...selecionadas, tag] : selecionadas.filter((item) => item !== tag))} />
            {tag}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function EtiquetasDeTags({ tags }: { tags?: readonly string[] }) {
  const { textos } = useIdioma();

  if (!tags?.length) return null;
  return <ul className="lista-de-tags" aria-label={textos.cartao.tags}>{tags.map((tag) => <li key={tag} className="tag">{tag}</li>)}</ul>;
}
