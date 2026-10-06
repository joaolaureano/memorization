let avisoPendente: { baralhoId: string; texto: string } | null = null;

export function guardarAvisoDeCartao(baralhoId: string, texto: string): void {
  avisoPendente = { baralhoId, texto };
}

export function consumirAvisoDeCartao(baralhoId: string): string | null {
  if (avisoPendente?.baralhoId !== baralhoId) return null;
  const texto = avisoPendente.texto;
  avisoPendente = null;
  return texto;
}
