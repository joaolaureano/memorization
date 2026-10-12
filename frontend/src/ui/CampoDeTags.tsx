import { useState } from "react";

/** Campo reutilizável para adicionar tags com Enter e remover cada etiqueta. */
export function CampoDeTags({
  tags,
  aoAlterar,
}: {
  tags: readonly string[];
  aoAlterar: (tags: string[]) => void;
}) {
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
      <label className="rotulo" htmlFor="campo-tag">Tags</label>
      <input id="campo-tag" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={adicionar} placeholder="Digite uma tag e pressione Enter" />
      <ul className="lista-de-tags" aria-label="Tags adicionadas">
        {tags.map((tag) => (
          <li key={tag} className="tag">
            <span>{tag}</span>
            <button type="button" aria-label={`Remover tag ${tag}`} onClick={() => aoAlterar(tags.filter((item) => item !== tag))}>×</button>
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
  if (opcoes.length === 0) return null;
  return (
    <fieldset className="filtro-de-tags">
      <legend>Tags</legend>
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
  if (!tags?.length) return null;
  return <ul className="lista-de-tags" aria-label="Tags">{tags.map((tag) => <li key={tag} className="tag">{tag}</li>)}</ul>;
}
