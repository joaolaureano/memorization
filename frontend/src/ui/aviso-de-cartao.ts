let avisoPendente: { baralhoId: string; frente: string } | null = null;

export function guardarAvisoDeCartao(baralhoId: string, frente: string): void {
  avisoPendente = { baralhoId, frente };
}

export function consumirAvisoDeCartao(baralhoId: string): string | null {
  if (avisoPendente?.baralhoId !== baralhoId) return null;
  const frente = avisoPendente.frente;
  avisoPendente = null;
  return frente;
}
