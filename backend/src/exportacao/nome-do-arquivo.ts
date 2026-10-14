export function nomeDoArquivoDeExportacao(nome: string): string {
  const seguro = nome
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "-")
    .slice(0, 100)
    .trim();
  return `${seguro || "exportacao"}.apkg`;
}
